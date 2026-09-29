-- Migrates friends, connected-accounts toggles, program-notify toggles, and
-- purchases out of profiles.settings (jsonb) into their own real, RLS-scoped
-- tables — plus the three single-value fields (friends_opt_in, box_code, city)
-- that move onto profiles directly, next to the other individual profile columns.

alter table profiles
  add column if not exists friends_opt_in boolean not null default false,
  add column if not exists box_code text,
  add column if not exists city text;

create table if not exists friends (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null,
  bumped boolean not null default false,
  date timestamptz not null default now()
);
alter table friends enable row level security;
drop policy if exists "friends are self-owned" on friends;
create policy "friends are self-owned" on friends
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists connected_accounts (
  user_id uuid not null references auth.users (id) on delete cascade,
  network text not null,
  connected boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, network)
);
alter table connected_accounts enable row level security;
drop policy if exists "connected accounts are self-owned" on connected_accounts;
create policy "connected accounts are self-owned" on connected_accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists program_notify (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  notify boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table program_notify enable row level security;
drop policy if exists "program notify is self-owned" on program_notify;
create policy "program notify is self-owned" on program_notify
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists purchases (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  price numeric not null,
  date timestamptz not null default now()
);
alter table purchases enable row level security;
drop policy if exists "purchases are self-owned" on purchases;
create policy "purchases are self-owned" on purchases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
