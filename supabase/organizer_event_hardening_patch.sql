-- Patch: organizer compliance fields + participant auth policy + duplicate event protection.
-- Run in Supabase SQL Editor on existing projects.
-- If you already have duplicated events (same date/name/location), clean them before running the unique index section.

do $$
begin
  create type public.participant_auth_mode as enum (
    'anonymous',
    'email',
    'social_verified',
    'flexible'
  );
exception
  when duplicate_object then null;
end
$$;

alter type public.registration_status add value if not exists 'pending_cash';

alter table public.organizers
  add column if not exists organization_name text,
  add column if not exists organization_role text not null default 'altro',
  add column if not exists organization_role_label text,
  add column if not exists legal_representative text,
  add column if not exists official_phone text,
  add column if not exists compliance_documents jsonb not null default '{
    "identityDocumentUrl": "",
    "organizationDocumentUrl": "",
    "paymentAuthorizationDocumentUrl": "",
    "adminContactMessage": ""
  }'::jsonb,
  add column if not exists compliance_submitted_at timestamptz,
  add column if not exists paid_feature_unlocked boolean not null default false,
  add column if not exists paid_feature_unlock_requested_at timestamptz,
  add column if not exists paid_feature_unlock_contact text not null default 'profstefanoferrari',
  add column if not exists sponsor_module_enabled boolean not null default false,
  add column if not exists sponsor_module_activated_at timestamptz,
  add column if not exists sponsor_module_activation_amount numeric(10, 2) not null default 25,
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_charges_enabled boolean not null default false,
  add column if not exists stripe_connect_payouts_enabled boolean not null default false,
  add column if not exists stripe_connect_details_submitted boolean not null default false,
  add column if not exists stripe_connect_last_sync_at timestamptz;

alter table public.events
  add column if not exists event_end_date date,
  add column if not exists event_time time,
  add column if not exists participant_auth_mode public.participant_auth_mode not null default 'anonymous',
  add column if not exists participant_phone_required boolean not null default false,
  add column if not exists cash_payment_enabled boolean not null default false,
  add column if not exists cash_payment_instructions text,
  add column if not exists cash_payment_deadline date,
  add column if not exists registrations_open boolean not null default true,
  add column if not exists closed_at timestamptz,
  add column if not exists definitive_published_at timestamptz,
  add column if not exists season_version integer not null default 1,
  add column if not exists last_participants_reset_at timestamptz;

alter table public.registrations
  add column if not exists group_participants_count integer not null default 1;

update public.events
set event_end_date = event_date
where event_end_date is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_end_date_not_before_start'
  ) then
    alter table public.events
      add constraint events_end_date_not_before_start
      check (event_end_date is null or event_end_date >= event_date);
  end if;
end
$$;

create unique index if not exists uq_events_name_location_date
on public.events (event_date, lower(btrim(name)), lower(btrim(location)));
