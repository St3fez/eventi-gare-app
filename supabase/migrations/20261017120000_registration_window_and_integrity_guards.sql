-- 1) Registration window chosen by the organizer was stored only on the organizer's device.
alter table public.events
  add column if not exists registration_open_date date,
  add column if not exists registration_close_date date;

alter table public.events
  drop constraint if exists events_registration_window_valid;
alter table public.events
  add constraint events_registration_window_valid check (
    registration_open_date is null
    or registration_close_date is null
    or registration_close_date >= registration_open_date
  );

-- 2) Organizers must not self-approve paid events (manual claim review is admin-only).
create or replace function public.guard_event_claim_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') not in ('authenticated', 'anon') or public.is_platform_admin() then
    return new;
  end if;

  if new.is_free then
    new.claim_status := 'not_required';
  elsif tg_op = 'INSERT' then
    new.claim_status := 'pending_review';
  elsif new.claim_status is distinct from old.claim_status
    or (old.is_free and not new.is_free) then
    -- an organizer can only (re)submit for review; approval/rejection is admin-only
    new.claim_status := 'pending_review';
  end if;

  if tg_op = 'INSERT' then
    new.claim_approved_at := null;
    new.claim_approved_by := null;
    new.claim_rejected_at := null;
    new.claim_rejected_reason := null;
  else
    new.claim_approved_at := old.claim_approved_at;
    new.claim_approved_by := old.claim_approved_by;
    new.claim_rejected_at := old.claim_rejected_at;
    new.claim_rejected_reason := old.claim_rejected_reason;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_event_claim_fields on public.events;
create trigger trg_guard_event_claim_fields
  before insert or update on public.events
  for each row execute function public.guard_event_claim_fields();

-- 3) Participants must not mark themselves as paid, change the charged amount or the commission,
--    or register outside the organizer's registration window.
-- security definer: the checks must see the event and existing codes regardless of the caller's RLS.
create or replace function public.guard_registration_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  is_event_organizer boolean;
  today date := (now() at time zone 'Europe/Rome')::date;
  unit_count integer;
begin
  if coalesce(auth.role(), 'service_role') not in ('authenticated', 'anon') or public.is_platform_admin() then
    return new;
  end if;

  select e.id, e.organizer_id, e.is_free, e.fee_amount, e.active, e.registrations_open,
         e.closed_at, e.event_date, e.event_end_date, e.created_at,
         e.registration_open_date, e.registration_close_date
    into ev
    from public.events e
   where e.id = new.event_id;

  if not found then
    raise exception 'Evento non trovato.';
  end if;

  select exists (
    select 1 from public.organizers o
     where o.id = ev.organizer_id and o.user_id = auth.uid()
  ) into is_event_organizer;

  if is_event_organizer then
    return new;
  end if;

  unit_count := greatest(1, coalesce(new.group_participants_count, 1));

  -- Amounts are always derived from the event, never trusted from the client.
  if ev.is_free then
    new.payment_amount := 0;
    new.commission_amount := 0;
  else
    new.payment_amount := round((ev.fee_amount * unit_count)::numeric, 2);
    new.commission_amount := round((ev.fee_amount * unit_count * 0.03)::numeric, 2);
  end if;

  if tg_op = 'INSERT' then
    -- The app syncs with upsert(on registration_code): an existing code means this insert
    -- becomes an update, which the UPDATE branch below handles.
    if exists (
      select 1 from public.registrations r where r.registration_code = new.registration_code
    ) then
      return new;
    end if;
    if not ev.active or not coalesce(ev.registrations_open, true) or ev.closed_at is not null then
      raise exception 'Iscrizioni chiuse per questo evento.';
    end if;
    if today < coalesce(ev.registration_open_date, (ev.created_at at time zone 'Europe/Rome')::date)
      or today > coalesce(ev.registration_close_date, ev.event_end_date, ev.event_date) then
      raise exception 'Iscrizioni fuori dal periodo consentito.';
    end if;
    if new.payment_captured_at is not null or new.refunded_at is not null
      or new.payment_status in ('captured', 'refunded')
      or new.registration_status = 'refunded'
      or (new.registration_status = 'paid' and not ev.is_free) then
      raise exception 'Stato di pagamento non consentito.';
    end if;
    return new;
  end if;

  -- UPDATE by the participant: payment outcome fields are owned by the server/organizer,
  -- so client values are ignored rather than rejected (the app resends the whole row).
  new.payment_intent_id := old.payment_intent_id;
  new.payment_captured_at := old.payment_captured_at;
  new.refunded_at := old.refunded_at;
  if new.payment_status is distinct from old.payment_status
    and new.payment_status in ('captured', 'refunded') then
    new.payment_status := old.payment_status;
  end if;
  if new.registration_status is distinct from old.registration_status
    and (new.registration_status = 'refunded' or (new.registration_status = 'paid' and not ev.is_free)) then
    new.registration_status := old.registration_status;
  end if;
  if not ev.is_free and old.registration_status = 'paid' then
    -- amount already charged: keep what was actually paid
    new.payment_amount := old.payment_amount;
    new.commission_amount := old.commission_amount;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_registration_integrity on public.registrations;
create trigger trg_guard_registration_integrity
  before insert or update on public.registrations
  for each row execute function public.guard_registration_integrity();

-- The stricter registrations_insert_participant policy already covers participant inserts;
-- this permissive one let clients skip the consent and active-event checks.
drop policy if exists registrations_insert_own on public.registrations;

-- 4) Advisor fixes.
alter function public.current_auth_email() set search_path = public;
alter function public.guard_organizer_sensitive_fields() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
