-- Cleanup for full E2E test runs on 2026-02-28.
-- Safe to execute multiple times.

delete from public.organizers
where id in (
  '7c1ec011-8895-4c34-b53d-390e07311b23',
  '478dfee6-cb14-4c3d-b067-274728ed3213'
);
