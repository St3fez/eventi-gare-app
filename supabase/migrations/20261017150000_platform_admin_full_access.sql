-- Platform admins (admin_users, matched on the verified JWT email) get full access everywhere.
-- Other roles are unchanged: these policies only add rights for is_platform_admin().

drop policy if exists organizers_admin_delete on public.organizers;
create policy organizers_admin_delete on public.organizers
  for delete to authenticated using (public.is_platform_admin());

drop policy if exists registrations_admin_delete on public.registrations;
create policy registrations_admin_delete on public.registrations
  for delete to authenticated using (public.is_platform_admin());

drop policy if exists payment_intents_admin_all on public.payment_intents;
create policy payment_intents_admin_all on public.payment_intents
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists sponsor_slots_admin_all on public.sponsor_slots;
create policy sponsor_slots_admin_all on public.sponsor_slots
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists webhook_events_admin_select on public.webhook_events;
create policy webhook_events_admin_select on public.webhook_events
  for select to authenticated using (public.is_platform_admin());

drop policy if exists sponsor_webhook_events_admin_select on public.sponsor_webhook_events;
create policy sponsor_webhook_events_admin_select on public.sponsor_webhook_events
  for select to authenticated using (public.is_platform_admin());

drop policy if exists sponsor_module_webhook_events_admin_select on public.sponsor_module_webhook_events;
create policy sponsor_module_webhook_events_admin_select on public.sponsor_module_webhook_events
  for select to authenticated using (public.is_platform_admin());
