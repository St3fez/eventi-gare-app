-- Cleanup for technical end-to-end smoke tests run on 2026-02-28.
-- Safe to execute multiple times.

delete from public.organizers
where id in (
  '75affaf8-b5ec-437a-90be-e0210feea0ae',
  '5e61edf9-8675-4ae1-add8-92f86fde4f77',
  '99912ed6-65ea-4f8c-b679-1d7b07a1509e'
);
