alter table public.registrations
  add column if not exists group_participants jsonb not null default '[]'::jsonb;

alter table public.registrations
  add column if not exists participant_message_to_organizer text;
