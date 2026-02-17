-- Supabase schema for Eventi Slash Gare
-- Run in Supabase SQL editor (project with Auth enabled)

create extension if not exists pgcrypto;

create type public.organizer_verification_status as enum (
  'pending_review',
  'verified',
  'rejected',
  'suspended'
);

create type public.registration_status as enum (
  'pending_payment',
  'paid',
  'cancelled',
  'payment_failed',
  'refunded'
);

create type public.payment_intent_status as enum (
  'pending',
  'requires_action',
  'authorized',
  'captured',
  'failed',
  'expired',
  'refunded',
  'cancelled'
);

create type public.payment_provider as enum (
  'stripe',
  'manual_demo'
);

create type public.payment_webhook_type as enum (
  'payment_intent.succeeded',
  'payment_intent.failed',
  'payment_intent.expired',
  'payment_intent.refunded'
);

create type public.sponsor_slot_status as enum (
  'pending_payment',
  'active',
  'expired',
  'cancelled',
  'payment_failed',
  'refunded'
);

create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  fiscal_data text,
  bank_account text,
  verification_status public.organizer_verification_status not null default 'pending_review',
  payout_enabled boolean not null default false,
  risk_score integer not null default 0,
  risk_flags text[] not null default '{}',
  verification_checklist jsonb not null default '{
    "emailVerified": false,
    "fiscalDataVerified": false,
    "ibanOwnershipVerified": false,
    "identityVerified": false,
    "manualReviewPassed": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  name text not null,
  location text not null,
  event_date date not null,
  is_free boolean not null,
  fee_amount numeric(10, 2) not null default 0,
  privacy_text text not null,
  logo_url text,
  local_sponsor text,
  assign_numbers boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  participant_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  participant_email text not null,
  phone text,
  city text,
  birth_date date,
  privacy_consent boolean not null default false,
  retention_consent boolean not null default false,
  assigned_number integer,
  registration_code text not null unique,
  registration_status public.registration_status not null default 'pending_payment',
  payment_intent_id uuid,
  payment_status public.payment_intent_status,
  payment_amount numeric(10, 2) not null default 0,
  payment_method text,
  payment_reference text,
  payment_session_expires_at timestamptz,
  payment_captured_at timestamptz,
  payment_failed_reason text,
  refunded_at timestamptz,
  commission_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  provider public.payment_provider not null,
  currency text not null default 'EUR',
  amount numeric(10, 2) not null,
  status public.payment_intent_status not null default 'pending',
  idempotency_key text not null unique,
  provider_payment_intent_id text,
  webhook_event_id text,
  failure_reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  webhook_event_id text primary key,
  provider public.payment_provider not null,
  event_type public.payment_webhook_type not null,
  payment_intent_id uuid references public.payment_intents(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_events_organizer on public.events(organizer_id);
create index if not exists idx_events_active_date on public.events(active, event_date);
create index if not exists idx_reg_event_status on public.registrations(event_id, registration_status);
create index if not exists idx_reg_organizer on public.registrations(organizer_id);
create index if not exists idx_payment_intents_registration on public.payment_intents(registration_id);
create index if not exists idx_payment_intents_event_status on public.payment_intents(event_id, status);
create index if not exists idx_sponsor_slots_event on public.sponsor_slots(event_id);
create index if not exists idx_sponsor_slots_organizer on public.sponsor_slots(organizer_id);
create index if not exists idx_sponsor_slots_active_expiry on public.sponsor_slots(active, ends_at);
create index if not exists idx_sponsor_slots_status on public.sponsor_slots(status);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_organizers on public.organizers;
create trigger trg_touch_organizers
before update on public.organizers
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_events on public.events;
create trigger trg_touch_events
before update on public.events
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_registrations on public.registrations;
create trigger trg_touch_registrations
before update on public.registrations
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_payment_intents on public.payment_intents;
create trigger trg_touch_payment_intents
before update on public.payment_intents
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_sponsor_slots on public.sponsor_slots;
create trigger trg_touch_sponsor_slots
before update on public.sponsor_slots
for each row execute function public.touch_updated_at();

-- Idempotent webhook processor. Call from server/edge function with service role.
create or replace function public.apply_payment_webhook(
  p_webhook_event_id text,
  p_provider public.payment_provider,
  p_event_type public.payment_webhook_type,
  p_payment_intent_id uuid,
  p_provider_payment_intent_id text,
  p_payment_reference text,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_registration public.registrations%rowtype;
  v_assign_numbers boolean;
  v_next_number integer;
begin
  if exists (select 1 from public.webhook_events where webhook_event_id = p_webhook_event_id) then
    return false;
  end if;

  insert into public.webhook_events (
    webhook_event_id,
    provider,
    event_type,
    payment_intent_id,
    payload
  ) values (
    p_webhook_event_id,
    p_provider,
    p_event_type,
    p_payment_intent_id,
    coalesce(p_payload, '{}'::jsonb)
  );

  select *
  into v_intent
  from public.payment_intents
  where id = p_payment_intent_id
  for update;

  if not found then
    raise exception 'Payment intent non trovato: %', p_payment_intent_id;
  end if;

  select *
  into v_registration
  from public.registrations
  where id = v_intent.registration_id
  for update;

  if not found then
    raise exception 'Registrazione non trovata per payment intent: %', p_payment_intent_id;
  end if;

  if p_event_type = 'payment_intent.succeeded' then
    select assign_numbers into v_assign_numbers from public.events where id = v_registration.event_id;

    if v_assign_numbers and v_registration.assigned_number is null then
      select coalesce(max(r.assigned_number), 0) + 1
      into v_next_number
      from public.registrations r
      where r.event_id = v_registration.event_id
        and r.registration_status = 'paid';
    end if;

    update public.payment_intents
    set
      status = 'captured',
      provider_payment_intent_id = p_provider_payment_intent_id,
      webhook_event_id = p_webhook_event_id,
      failure_reason = null
    where id = v_intent.id;

    update public.registrations
    set
      registration_status = 'paid',
      payment_status = 'captured',
      assigned_number = coalesce(v_registration.assigned_number, v_next_number),
      payment_reference = coalesce(nullif(p_payment_reference, ''), payment_reference),
      payment_failed_reason = null,
      payment_captured_at = now()
    where id = v_registration.id;

  elsif p_event_type = 'payment_intent.failed' then
    update public.payment_intents
    set
      status = 'failed',
      provider_payment_intent_id = p_provider_payment_intent_id,
      webhook_event_id = p_webhook_event_id,
      failure_reason = coalesce(p_reason, 'Pagamento non autorizzato')
    where id = v_intent.id;

    update public.registrations
    set
      registration_status = 'payment_failed',
      payment_status = 'failed',
      payment_failed_reason = coalesce(p_reason, 'Pagamento non autorizzato')
    where id = v_registration.id;

  elsif p_event_type = 'payment_intent.expired' then
    update public.payment_intents
    set
      status = 'expired',
      webhook_event_id = p_webhook_event_id,
      failure_reason = coalesce(p_reason, 'Sessione pagamento scaduta')
    where id = v_intent.id;

    update public.registrations
    set
      registration_status = 'payment_failed',
      payment_status = 'expired',
      payment_failed_reason = coalesce(p_reason, 'Sessione pagamento scaduta')
    where id = v_registration.id;

  elsif p_event_type = 'payment_intent.refunded' then
    update public.payment_intents
    set
      status = 'refunded',
      webhook_event_id = p_webhook_event_id,
      failure_reason = null
    where id = v_intent.id;

    update public.registrations
    set
      registration_status = 'refunded',
      payment_status = 'refunded',
      refunded_at = now()
    where id = v_registration.id;

  else
    raise exception 'Tipo webhook non supportato: %', p_event_type;
  end if;

  return true;
end;
$$;

-- Idempotent webhook processor for sponsor slots.
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

  -- Safety net: never keep slot active if expired.
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

alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.payment_intents enable row level security;
alter table public.webhook_events enable row level security;
alter table public.sponsor_slots enable row level security;
alter table public.sponsor_webhook_events enable row level security;

-- Prevent organizer users from self-approving antifraud/KYC fields.
create or replace function public.guard_organizer_sensitive_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() in ('authenticated', 'anon') then
    if new.verification_status is distinct from old.verification_status
      or new.payout_enabled is distinct from old.payout_enabled
      or new.risk_score is distinct from old.risk_score
      or new.risk_flags is distinct from old.risk_flags
      or new.verification_checklist is distinct from old.verification_checklist then
      raise exception 'Modifica campi antifrode non consentita dal client.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_organizer_sensitive_fields on public.organizers;
create trigger trg_guard_organizer_sensitive_fields
before update on public.organizers
for each row execute function public.guard_organizer_sensitive_fields();

-- Organizers
drop policy if exists organizers_select_own on public.organizers;
create policy organizers_select_own on public.organizers
for select to authenticated
using (user_id = auth.uid());

drop policy if exists organizers_insert_own on public.organizers;
create policy organizers_insert_own on public.organizers
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists organizers_update_own on public.organizers;
create policy organizers_update_own on public.organizers
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Events: public read only active events, organizer full control on own records.
drop policy if exists events_select_public_active on public.events;
create policy events_select_public_active on public.events
for select to anon, authenticated
using (active = true);

drop policy if exists events_select_own_organizer on public.events;
create policy events_select_own_organizer on public.events
for select to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
for insert to authenticated
with check (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
for update to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
)
with check (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

drop policy if exists events_delete_own on public.events;
create policy events_delete_own on public.events
for delete to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

-- Registrations: organizer sees own event registrations, participant sees only own rows.
drop policy if exists registrations_select_own_participant_or_organizer on public.registrations;
create policy registrations_select_own_participant_or_organizer on public.registrations
for select to authenticated
using (
  participant_user_id = auth.uid()
  or organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

drop policy if exists registrations_insert_participant on public.registrations;
create policy registrations_insert_participant on public.registrations
for insert to authenticated
with check (
  participant_user_id = auth.uid()
  and privacy_consent = true
  and retention_consent = true
  and exists (
    select 1
    from public.events e
    where e.id = registrations.event_id
      and e.organizer_id = registrations.organizer_id
      and e.active = true
  )
);

drop policy if exists registrations_update_own_participant_or_organizer on public.registrations;
create policy registrations_update_own_participant_or_organizer on public.registrations
for update to authenticated
using (
  participant_user_id = auth.uid()
  or organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
)
with check (
  participant_user_id = auth.uid()
  or organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

-- Payment intents: readable by participant (via registration) and organizer of event.
drop policy if exists payment_intents_select_own_participant_or_organizer on public.payment_intents;
create policy payment_intents_select_own_participant_or_organizer on public.payment_intents
for select to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or exists (
    select 1
    from public.registrations r
    where r.id = payment_intents.registration_id
      and r.participant_user_id = auth.uid()
  )
);

-- Sponsor slots: public read only for active + not expired.
drop policy if exists sponsor_slots_select_public_active on public.sponsor_slots;
create policy sponsor_slots_select_public_active on public.sponsor_slots
for select to anon, authenticated
using (active = true and ends_at > now());

-- Organizer can read all own sponsor slots (including pending/expired).
drop policy if exists sponsor_slots_select_own_organizer on public.sponsor_slots;
create policy sponsor_slots_select_own_organizer on public.sponsor_slots
for select to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
);

-- No direct client writes on payment_intents/webhook_events (service role only).
revoke all on public.payment_intents from anon, authenticated;
grant select on public.payment_intents to authenticated;

revoke all on public.webhook_events from anon, authenticated;
revoke all on public.sponsor_slots from anon, authenticated;
grant select on public.sponsor_slots to anon, authenticated;
revoke all on public.sponsor_webhook_events from anon, authenticated;

-- Recommendation: run webhook processing via Edge Function using service role key.
