-- Public participant read policies for event discovery screens.
-- Safe to run multiple times.

drop policy if exists events_select_public_active on public.events;
create policy events_select_public_active on public.events
for select to anon, authenticated
using (active = true);

drop policy if exists sponsor_slots_select_public_active on public.sponsor_slots;
create policy sponsor_slots_select_public_active on public.sponsor_slots
for select to anon, authenticated
using (active = true and ends_at > now());

grant select on public.events to anon, authenticated;
grant select on public.sponsor_slots to anon, authenticated;
