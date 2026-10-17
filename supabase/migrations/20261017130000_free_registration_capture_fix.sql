-- Free registrations are stored as registration_status='paid' with payment_captured_at set by the app:
-- the payment-state checks only make sense for paid events.
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
    if not ev.is_free and (
      new.payment_captured_at is not null or new.refunded_at is not null
      or new.payment_status in ('captured', 'refunded')
      or new.registration_status in ('paid', 'refunded')
    ) then
      raise exception 'Stato di pagamento non consentito.';
    end if;
    return new;
  end if;

  if ev.is_free then
    return new;
  end if;

  -- UPDATE by the participant on a paid event: payment outcome fields are owned by the
  -- server/organizer, so client values are ignored rather than rejected (the app resends the whole row).
  new.payment_intent_id := old.payment_intent_id;
  new.payment_captured_at := old.payment_captured_at;
  new.refunded_at := old.refunded_at;
  if new.payment_status is distinct from old.payment_status
    and new.payment_status in ('captured', 'refunded') then
    new.payment_status := old.payment_status;
  end if;
  if new.registration_status is distinct from old.registration_status
    and new.registration_status in ('paid', 'refunded') then
    new.registration_status := old.registration_status;
  end if;
  if old.registration_status = 'paid' then
    -- amount already charged: keep what was actually paid
    new.payment_amount := old.payment_amount;
    new.commission_amount := old.commission_amount;
  end if;

  return new;
end;
$$;
