-- Which gym a member got their First Timer box from — the identifier the
-- month-two attendance report groups by. One code per gym (not per box), chosen
-- by the member in onboarding ("Which gym gave you your First Timer box?") and
-- editable later on Account.
--
-- gyms: the pilot gyms, as content. Adding a real gym once it commits is a Table
-- Editor row (active = true) — no app change. Seeded with ONE test entry only, not
-- real gyms: no gym has confirmed yet. It's inactive, so production builds never
-- list it; development builds also list inactive gyms, so it can be picked on a
-- test phone to exercise the whole flow.
--
-- profiles.gym_code + gym_set_at:
--   gym_set_at null              → never answered
--   gym_set_at set, gym_code null → answered "Somewhere else / I didn't get a box"
--   gym_set_at set, gym_code set  → that gym
-- A gym can't be deleted while members reference it (deactivate it instead), and
-- renaming a code carries over to everyone who picked it.
--
-- Safe to paste more than once.

create table if not exists gyms (
  code text primary key,
  name text not null,
  active boolean not null default false,
  sort_order int not null default 0,
  constraint gyms_code_format check (code ~ '^[A-Z0-9]{2,8}$')
);

alter table gyms enable row level security;

drop policy if exists "gyms_select" on gyms;

create policy "gyms_select"
on gyms
for select
using (auth.role() = 'authenticated');

insert into gyms (code, name, active, sort_order) values
  ('TEST', 'TEST — Dev Gym', false, 999)
on conflict (code) do nothing;

alter table profiles
  add column if not exists gym_code text references gyms (code) on update cascade on delete restrict,
  add column if not exists gym_set_at timestamptz;
