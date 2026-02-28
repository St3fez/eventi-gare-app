-- Admin RBAC and policy bypass for platform administrators.
-- Safe to run on existing production database.

create table if not exists public.admin_users (
  email text primary key,
  can_manage_admins boolean not null default false,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_email_lowercase check (email = lower(email))
);

create index if not exists idx_admin_users_active on public.admin_users(active);

create or replace function public.current_auth_email()
returns text
language sql
stable
as $$
  select nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '');
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.email = public.current_auth_email()
      and a.active = true
  );
$$;

create or replace function public.can_manage_platform_admins()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.email = public.current_auth_email()
      and a.active = true
      and a.can_manage_admins = true
  );
$$;

insert into public.admin_users (email, can_manage_admins, active, created_by)
values ('profstefanoferrari@gmail.com', true, true, 'migration')
on conflict (email) do update
set
  can_manage_admins = excluded.can_manage_admins,
  active = true;

do $$
begin
  if to_regprocedure('public.touch_updated_at()') is not null then
    execute 'drop trigger if exists trg_touch_admin_users on public.admin_users';
    execute 'create trigger trg_touch_admin_users before update on public.admin_users for each row execute function public.touch_updated_at()';
  end if;
end
$$;

alter table public.admin_users enable row level security;

create or replace function public.guard_organizer_sensitive_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() in ('authenticated', 'anon') and not public.is_platform_admin() then
    if new.verification_status is distinct from old.verification_status
      or new.payout_enabled is distinct from old.payout_enabled
      or new.stripe_connect_account_id is distinct from old.stripe_connect_account_id
      or new.stripe_connect_charges_enabled is distinct from old.stripe_connect_charges_enabled
      or new.stripe_connect_payouts_enabled is distinct from old.stripe_connect_payouts_enabled
      or new.stripe_connect_details_submitted is distinct from old.stripe_connect_details_submitted
      or new.stripe_connect_last_sync_at is distinct from old.stripe_connect_last_sync_at
      or new.risk_score is distinct from old.risk_score
      or new.risk_flags is distinct from old.risk_flags
      or new.verification_checklist is distinct from old.verification_checklist then
      raise exception 'Modifica campi antifrode non consentita dal client.';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists admin_users_select_admin on public.admin_users;
create policy admin_users_select_admin on public.admin_users
for select to authenticated
using (public.is_platform_admin());

drop policy if exists admin_users_insert_manage on public.admin_users;
create policy admin_users_insert_manage on public.admin_users
for insert to authenticated
with check (public.can_manage_platform_admins());

drop policy if exists admin_users_update_manage on public.admin_users;
create policy admin_users_update_manage on public.admin_users
for update to authenticated
using (public.can_manage_platform_admins())
with check (public.can_manage_platform_admins());

drop policy if exists admin_users_delete_manage on public.admin_users;
create policy admin_users_delete_manage on public.admin_users
for delete to authenticated
using (public.can_manage_platform_admins());

drop policy if exists organizers_select_own on public.organizers;
create policy organizers_select_own on public.organizers
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
);

drop policy if exists organizers_insert_own on public.organizers;
create policy organizers_insert_own on public.organizers
for insert to authenticated
with check (
  user_id = auth.uid()
  or public.is_platform_admin()
);

drop policy if exists organizers_update_own on public.organizers;
create policy organizers_update_own on public.organizers
for update to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
)
with check (
  user_id = auth.uid()
  or public.is_platform_admin()
);

drop policy if exists events_select_own_organizer on public.events;
create policy events_select_own_organizer on public.events
for select to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
for insert to authenticated
with check (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
for update to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
)
with check (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists events_delete_own on public.events;
create policy events_delete_own on public.events
for delete to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists registrations_select_own_participant_or_organizer on public.registrations;
create policy registrations_select_own_participant_or_organizer on public.registrations
for select to authenticated
using (
  participant_user_id = auth.uid()
  or organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists registrations_insert_participant on public.registrations;
create policy registrations_insert_participant on public.registrations
for insert to authenticated
with check (
  (
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
  )
  or (
    public.is_platform_admin()
    and exists (
      select 1
      from public.events e
      where e.id = registrations.event_id
        and e.organizer_id = registrations.organizer_id
    )
  )
);

drop policy if exists registrations_update_own_participant_or_organizer on public.registrations;
create policy registrations_update_own_participant_or_organizer on public.registrations
for update to authenticated
using (
  participant_user_id = auth.uid()
  or organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
)
with check (
  participant_user_id = auth.uid()
  or organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists payment_intents_select_own_participant_or_organizer on public.payment_intents;
create policy payment_intents_select_own_participant_or_organizer on public.payment_intents
for select to authenticated
using (
  organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
  or public.is_platform_admin()
  or exists (
    select 1
    from public.registrations r
    where r.id = payment_intents.registration_id
      and r.participant_user_id = auth.uid()
  )
);

do $$
begin
  if to_regclass('public.sponsor_slots') is not null then
    execute 'drop policy if exists sponsor_slots_select_own_organizer on public.sponsor_slots';
    execute $sql$
      create policy sponsor_slots_select_own_organizer on public.sponsor_slots
      for select to authenticated
      using (
        organizer_id in (select o.id from public.organizers o where o.user_id = auth.uid())
        or public.is_platform_admin()
      )
    $sql$;
  end if;
end
$$;

revoke all on public.admin_users from anon, authenticated;
grant select, insert, update, delete on public.admin_users to authenticated;
