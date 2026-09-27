-- Weekly body-weight log (prototype's state.weighins). Same shape as mobility_logs/
-- walks: client-generated UUID, last-write-wins on upsert (see CLAUDE.md's sync rule).
-- Paste into Supabase SQL Editor -> New query -> Run.

create table if not exists weighins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null,
  w numeric not null,
  updated_at timestamptz not null default now()
);

alter table weighins enable row level security;

drop policy if exists "weighins are self-owned" on weighins;
create policy "weighins are self-owned" on weighins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
