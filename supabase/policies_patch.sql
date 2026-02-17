-- Eventi Slash Gare - RLS policy patch (safe to run multiple times)
-- Run this file in Supabase SQL Editor on the target project.

alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.payment_intents enable row level security;
alter table public.webhook_events enable row level security;
do $$
begin
  if to_regclass('public.sponsor_slots') is not null then
    execute 'alter table public.sponsor_slots enable row level security';
  end if;
  if to_regclass('public.sponsor_webhook_events') is not null then
    execute 'alter table public.sponsor_webhook_events enable row level security';
  end if;
end
$$;

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

-- Events
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

-- Registrations
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

-- Payment intents
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

-- Sponsor slots (only if sponsor module exists)
do $$
begin
  if to_regclass('public.sponsor_slots') is not null then
    execute 'drop policy if exists sponsor_slots_select_public_active on public.sponsor_slots';
    execute $sql$
      create policy sponsor_slots_select_public_active on public.sponsor_slots
      for select to anon, authenticated
      using (active = true and ends_at > now())
    $sql$;

    execute 'drop policy if exists sponsor_slots_select_own_organizer on public.sponsor_slots';
    execute $sql$
      create policy sponsor_slots_select_own_organizer on public.sponsor_slots
      for select to authenticated
      using (
        organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
      )
    $sql$;
  end if;
end
$$;

-- No direct client writes on payment_intents/webhook_events (service role only).
revoke all on public.payment_intents from anon, authenticated;
grant select on public.payment_intents to authenticated;
revoke all on public.webhook_events from anon, authenticated;
do $$
begin
  if to_regclass('public.sponsor_slots') is not null then
    execute 'revoke all on public.sponsor_slots from anon, authenticated';
    execute 'grant select on public.sponsor_slots to anon, authenticated';
  end if;
  if to_regclass('public.sponsor_webhook_events') is not null then
    execute 'revoke all on public.sponsor_webhook_events from anon, authenticated';
  end if;
end
$$;
