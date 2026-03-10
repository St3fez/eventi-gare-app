alter table public.events
  add column if not exists claim_status text not null default 'not_required',
  add column if not exists claim_submission_method text,
  add column if not exists claim_official_email text,
  add column if not exists claim_social_handle text,
  add column if not exists claim_evidence_file_name text,
  add column if not exists claim_requested_at timestamptz,
  add column if not exists claim_approved_at timestamptz,
  add column if not exists claim_approved_by text,
  add column if not exists claim_rejected_at timestamptz,
  add column if not exists claim_rejected_reason text;

update public.events
set claim_status = case
  when is_free then 'not_required'
  else 'approved'
end
where claim_status is null
   or claim_status not in ('not_required', 'pending_review', 'approved', 'rejected');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_claim_status_check'
  ) then
    alter table public.events
      add constraint events_claim_status_check
      check (claim_status in ('not_required', 'pending_review', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_claim_submission_method_check'
  ) then
    alter table public.events
      add constraint events_claim_submission_method_check
      check (
        claim_submission_method is null or
        claim_submission_method in ('official_email', 'social_profile')
      );
  end if;
end
$$;
