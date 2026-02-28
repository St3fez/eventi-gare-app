-- Cleanup E2E run data created on 2026-02-28.
-- Safe to execute multiple times.

delete from public.organizers
where id = '6f5b43cd-702f-485c-881f-8c385408526e';
