-- First Timer — initial schema.
-- Paste this whole file into the Supabase dashboard: SQL Editor -> New query -> Run.
--
-- Sync rule (see CLAUDE.md): sessions are append-only, one client-generated UUID per
-- record, written local-first and pushed when online, last-write-wins on collision.
-- No merge logic, no server-side conflict resolution.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  units text not null default 'imperial',
  training_location text not null default 'gym',
  reps text not null default 'balanced',
  length int not null default 45,
  pain text[] not null default '{}',
  block int not null default 1,
  session int not null default 0,
  streak int not null default 0,
  last_date timestamptz,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are self-owned" on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists sessions (
  id uuid primary key, -- client-generated, so a retried push can't create a duplicate
  user_id uuid not null references auth.users (id) on delete cascade,
  block int not null,
  idx int not null,
  letter text not null,
  week int not null,
  date timestamptz not null,
  moves jsonb not null default '{}',
  note text not null default '',
  minutes int not null default 0,
  tags text[] not null default '{}',
  rating int,
  updated_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "sessions are self-owned" on sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per person per session (block+idx), matching the app's own uniqueness rule.
create unique index if not exists sessions_user_block_idx on sessions (user_id, block, idx);

-- Auto-create a blank profile row the moment someone signs up, so the app never has
-- to handle "signed in but no profile row yet".
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
