-- Stores the whole Settings object as JSON rather than one column per field.
-- Paste into Supabase SQL Editor -> New query -> Run.

alter table profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;
