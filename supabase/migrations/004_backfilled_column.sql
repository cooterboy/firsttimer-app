-- Paste into Supabase SQL Editor -> New query -> Run.

alter table sessions
  add column if not exists backfilled boolean not null default false;
