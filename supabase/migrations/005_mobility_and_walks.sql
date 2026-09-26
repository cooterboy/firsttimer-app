-- Mobility day and walk/run logging. Same shape as sessions: client-generated UUID,
-- append-only, last-write-wins on upsert (see CLAUDE.md's sync rule).
-- The mobility frequency setting itself needs no migration — it's just a new key
-- inside the existing profiles.settings jsonb column from migration 003.
-- Paste into Supabase SQL Editor -> New query -> Run.

create table if not exists mobility_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null,
  minutes int not null default 0,
  updated_at timestamptz not null default now()
);

alter table mobility_logs enable row level security;

create policy "mobility_logs are self-owned" on mobility_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists walks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null,
  minutes int not null default 0,
  kind text not null default 'walk',
  feel text not null default '',
  hurt text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table walks enable row level security;

create policy "walks are self-owned" on walks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
