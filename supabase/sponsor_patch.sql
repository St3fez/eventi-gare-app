-- Eventi - Sponsor module patch (safe to run multiple times)
-- Run in Supabase SQL Editor after base schema.

create extension if not exists pgcrypto;

do $$
begin
  create type public.sponsor_slot_status as enum (
    'pending_payment',
    'active',
    'expired',
    'cancelled',
    'payment_failed',
    'refunded'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.sponsor_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  sponsor_name text not null,
  sponsor_name_it text not null,
  sponsor_name_en text not null,
  sponsor_url text,
  sponsor_logo_url text,
  package_days integer not null check (package_days > 0),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  contract_terms jsonb not null default '{"it":"","en":""}'::jsonb,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_payment_link_url text,
  payer_email text,
  status public.sponsor_slot_status not null default 'pending_payment',
  active boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.sponsor_webhook_events (
  webhook_event_id text primary key,
  event_type text not null,
  sponsor_slot_id uuid references public.sponsor_slots(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsor_module_webhook_events (
  webhook_event_id text primary key,
  event_type text not null,
  organizer_id uuid references public.organizers(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sponsor_slots_event on public.sponsor_slots(event_id);
create index if not exists idx_sponsor_slots_organizer on public.sponsor_slots(organizer_id);
create index if not exists idx_sponsor_slots_active_expiry on public.sponsor_slots(active, ends_at);
create index if not exists idx_sponsor_slots_status on public.sponsor_slots(status);

drop trigger if exists trg_touch_sponsor_slots on public.sponsor_slots;
create trigger trg_touch_sponsor_slots
before update on public.sponsor_slots
for each row execute function public.touch_updated_at();

create or replace function public.apply_sponsor_webhook(
  p_webhook_event_id text,
  p_event_type text,
  p_sponsor_slot_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_payment_link_url text default null,
  p_payer_email text default null,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.sponsor_slots%rowtype;
begin
  if exists (
    select 1
    from public.sponsor_webhook_events
    where webhook_event_id = p_webhook_event_id
  ) then
    return false;
  end if;

  insert into public.sponsor_webhook_events (
    webhook_event_id,
    event_type,
    sponsor_slot_id,
    payload
  ) values (
    p_webhook_event_id,
    p_event_type,
    p_sponsor_slot_id,
    coalesce(p_payload, '{}'::jsonb)
  );

  select *
  into v_slot
  from public.sponsor_slots
  where id = p_sponsor_slot_id
  for update;

  if not found then
    raise exception 'Sponsor slot non trovato: %', p_sponsor_slot_id;
  end if;

  if p_event_type = 'checkout.session.completed' then
    update public.sponsor_slots
    set
      status = case when ends_at > now() then 'active' else 'expired' end,
      active = ends_at > now(),
      stripe_checkout_session_id = coalesce(
        nullif(p_stripe_checkout_session_id, ''),
        stripe_checkout_session_id
      ),
      stripe_payment_intent_id = coalesce(
        nullif(p_stripe_payment_intent_id, ''),
        stripe_payment_intent_id
      ),
      stripe_payment_link_url = coalesce(nullif(p_payment_link_url, ''), stripe_payment_link_url),
      payer_email = coalesce(nullif(p_payer_email, ''), payer_email),
      paid_at = coalesce(paid_at, now()),
      cancelled_at = null
    where id = v_slot.id;

  elsif p_event_type = 'checkout.session.expired' then
    update public.sponsor_slots
    set
      status = 'expired',
      active = false
    where id = v_slot.id
      and status = 'pending_payment';

  elsif p_event_type = 'payment_intent.payment_failed' then
    update public.sponsor_slots
    set
      status = 'payment_failed',
      active = false
    where id = v_slot.id
      and status in ('pending_payment', 'active');

  elsif p_event_type = 'sponsor.cancelled' then
    update public.sponsor_slots
    set
      status = 'cancelled',
      active = false,
      cancelled_at = now(),
      contract_terms = jsonb_set(
        coalesce(contract_terms, '{}'::jsonb),
        '{reason}',
        to_jsonb(coalesce(p_reason, 'Cancellato')),
        true
      )
    where id = v_slot.id;

  elsif p_event_type = 'charge.refunded' then
    update public.sponsor_slots
    set
      status = 'refunded',
      active = false
    where id = v_slot.id;

  else
    raise exception 'Tipo webhook sponsor non supportato: %', p_event_type;
  end if;

  update public.sponsor_slots
  set
    status = case when status = 'active' then 'expired' else status end,
    active = false
  where id = v_slot.id
    and ends_at <= now()
    and active = true;

  return true;
end;
$$;

create or replace function public.apply_sponsor_module_webhook(
  p_webhook_event_id text,
  p_event_type text,
  p_organizer_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer public.organizers%rowtype;
begin
  if exists (
    select 1
    from public.sponsor_module_webhook_events
    where webhook_event_id = p_webhook_event_id
  ) then
    return false;
  end if;

  insert into public.sponsor_module_webhook_events (
    webhook_event_id,
    event_type,
    organizer_id,
    payload
  ) values (
    p_webhook_event_id,
    p_event_type,
    p_organizer_id,
    coalesce(p_payload, '{}'::jsonb)
  );

  select *
  into v_organizer
  from public.organizers
  where id = p_organizer_id
  for update;

  if not found then
    raise exception 'Organizer non trovato: %', p_organizer_id;
  end if;

  if p_event_type = 'checkout.session.completed' then
    update public.organizers
    set
      sponsor_module_enabled = true,
      sponsor_module_activated_at = coalesce(sponsor_module_activated_at, now())
    where id = v_organizer.id;
  end if;

  return true;
end;
$$;

alter table public.sponsor_slots enable row level security;
alter table public.sponsor_webhook_events enable row level security;
alter table public.sponsor_module_webhook_events enable row level security;

drop policy if exists sponsor_slots_select_public_active on public.sponsor_slots;
create policy sponsor_slots_select_public_active on public.sponsor_slots
for select to anon, authenticated
using (active = true and ends_at > now());

drop policy if exists sponsor_slots_select_own_organizer on public.sponsor_slots;
create policy sponsor_slots_select_own_organizer on public.sponsor_slots
for select to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

revoke all on public.sponsor_slots from anon, authenticated;
grant select on public.sponsor_slots to anon, authenticated;
revoke all on public.sponsor_webhook_events from anon, authenticated;
revoke all on public.sponsor_module_webhook_events from anon, authenticated;

revoke execute on function public.apply_sponsor_webhook(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.apply_sponsor_webhook(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to service_role;

revoke execute on function public.apply_sponsor_module_webhook(
  text,
  text,
  uuid,
  jsonb
) from public, anon, authenticated;
grant execute on function public.apply_sponsor_module_webhook(
  text,
  text,
  uuid,
  jsonb
) to service_role;
