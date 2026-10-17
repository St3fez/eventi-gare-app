-- Trigger-only function: not meant to be exposed via /rest/v1/rpc.
revoke execute on function public.guard_registration_integrity() from anon, authenticated, public;
