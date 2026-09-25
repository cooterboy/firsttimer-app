-- Adds the fields the Account screen and the (pulled-out) nutrition card need.
-- Paste into Supabase SQL Editor -> New query -> Run.

alter table profiles
  add column if not exists age int,
  add column if not exists height_cm numeric,
  add column if not exists weight numeric,
  add column if not exists goal text;
