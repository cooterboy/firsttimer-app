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
  age int,
  height_cm numeric,
  weight numeric,
  goal text,
  days int not null default 3,
  activity text,
  why text,
  medical_disclaimer_accepted boolean not null default false,
  friends_opt_in boolean not null default false,
  box_code text,
  city text,
  recovery_adjusted_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
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
  backfilled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "sessions are self-owned" on sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per person per session (block+idx), matching the app's own uniqueness rule.
create unique index if not exists sessions_user_block_idx on sessions (user_id, block, idx);

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

create table if not exists weighins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null,
  w numeric not null,
  updated_at timestamptz not null default now()
);

alter table weighins enable row level security;

create policy "weighins are self-owned" on weighins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists friends (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null,
  bumped boolean not null default false,
  date timestamptz not null default now()
);

alter table friends enable row level security;

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

create policy "program notify is self-owned" on program_notify
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists purchases (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  price numeric not null,
  blocks int not null default 1,
  product_id text, -- migration 016: the store product (lib/blockCatalog.ts)
  date timestamptz not null default now(),
  constraint purchases_user_product_key unique (user_id, product_id)
);

alter table purchases enable row level security;

create policy "purchases are self-owned" on purchases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Content-as-data (migrations 009, 013, 014): categories → programs → session
-- templates → movement slots → swap/easier/pain alternatives, plus a shared
-- exercise library. Keyed by category so a new category or a new plan within one
-- is an INSERT, not a migration — see migration 013 for the reasoning. Shared
-- reference content, not per-user data — read-for-anyone-authenticated, no
-- insert/update/delete policy for regular users (edited via the Table Editor).
create table if not exists categories (
  key text primary key,
  name text not null,
  sub text not null default '',
  live boolean not null default false,
  sort_order int not null default 0
);

alter table categories enable row level security;

create policy "categories_select"
on categories
for select
using (auth.role() = 'authenticated');

create table if not exists programs (
  id text primary key,
  category text not null references categories (key) on delete cascade,
  where_keys text[] not null default '{gym}',
  name text not null,
  block_sessions int not null default 24,
  live boolean not null default false,
  sort_order int not null default 0,
  constraint programs_where_keys_check check (cardinality(where_keys) > 0)
);

create index if not exists programs_category_idx on programs (category, sort_order);

alter table programs enable row level security;

create policy "programs_select"
on programs
for select
using (auth.role() = 'authenticated');

create table if not exists session_templates (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references programs (id) on delete cascade,
  code text not null,
  label text not null default '',
  position int not null default 0
);

create unique index if not exists session_templates_program_code_idx on session_templates (program_id, code);
create index if not exists session_templates_program_position_idx on session_templates (program_id, position);

alter table session_templates enable row level security;

create policy "session_templates_select"
on session_templates
for select
using (auth.role() = 'authenticated');

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  category text not null references categories (key) on delete cascade,
  name text not null,
  cue text not null,
  why text,
  video_url text,
  unique (category, name)
);

alter table exercises enable row level security;

create policy "exercises_select"
on exercises
for select
using (auth.role() = 'authenticated');

create table if not exists template_movements (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references session_templates (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete restrict,
  position int not null default 0,
  kind text not null default 'weight',
  rest_sec int,
  per_side boolean not null default false,
  cue_override text,
  params jsonb not null default '{}'::jsonb
);

create index if not exists template_movements_template_idx on template_movements (template_id, position);

alter table template_movements enable row level security;

create policy "template_movements_select"
on template_movements
for select
using (auth.role() = 'authenticated');

create table if not exists movement_alternatives (
  id uuid primary key default gen_random_uuid(),
  template_movement_id uuid not null references template_movements (id) on delete cascade,
  reason text not null,
  pain_area text,
  exercise_id uuid not null references exercises (id) on delete restrict,
  kind text,
  per_side boolean,
  cue_override text,
  constraint movement_alternatives_pain_area_check check ((reason = 'pain') = (pain_area is not null))
);

create unique index if not exists movement_alternatives_one_per_reason_idx
  on movement_alternatives (template_movement_id, reason, coalesce(pain_area, ''));

alter table movement_alternatives enable row level security;

create policy "movement_alternatives_select"
on movement_alternatives
for select
using (auth.role() = 'authenticated');

-- Shop content as data (migration 012): gear/box-reorder items, same
-- shared-content RLS pattern as the content tables above.
create table if not exists shop_items (
  id uuid primary key,
  category text not null,
  section text not null,
  name text not null,
  blurb text not null default '',
  link text,
  sort_order int not null default 0
);

alter table shop_items enable row level security;

create policy "shop_items_select"
on shop_items
for select
using (auth.role() = 'authenticated');

-- Auto-create the profile row the moment someone signs up, so the app never has
-- to handle "signed in but no profile row yet" — filled with the name, units and
-- age sent with the sign-up (raw_user_meta_data), each checked (migration 017).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  age_text text := meta ->> 'age';
begin
  insert into public.profiles (id, name, units, age)
  values (
    new.id,
    coalesce(trim(meta ->> 'name'), ''),
    case when meta ->> 'units' in ('imperial', 'metric') then meta ->> 'units' else 'imperial' end,
    case when age_text ~ '^[0-9]{1,3}$' and age_text::int between 13 and 120 then age_text::int end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Seed content — see migrations 009, 013 and 014 for provenance.
insert into categories (key, name, sub, live, sort_order) values
  ('gym', 'Gym', '24 sessions a block · strength', true, 0),
  ('hyrox', 'Hyrox', '12 weeks to race day', false, 1),
  ('marathon', 'Marathon prep', '16 weeks, one long run at a time', false, 2)
on conflict (key) do nothing;

insert into programs (id, category, where_keys, name, block_sessions, live, sort_order) values
  ('gym', 'gym', '{gym,garage}', 'Gym', 24, true, 0)
on conflict (id) do nothing;

insert into session_templates (id, program_id, code, label, position) values
  ('b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 'gym', 'A', 'Session A', 0),
  ('53c169e4-192f-41dc-b0c4-625e853251c6', 'gym', 'B', 'Session B', 1),
  ('b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 'gym', 'C', 'Session C', 2)
on conflict (id) do nothing;

insert into exercises (category, name, cue, why) values
  ('gym', 'Assisted pull-up', 'Knees on the pad. Pull your chest to the bar.', null),
  ('gym', 'Band pulldown', 'Band over a bar. Pull to your chest.', null),
  ('gym', 'Band row', 'Band around a post. Squeeze your shoulder blades.', null),
  ('gym', 'Bird dog', 'Opposite arm and leg. Hold two seconds.', null),
  ('gym', 'Box squat', 'Sit back to a bench, stand up. No weight.', null),
  ('gym', 'Chest press machine', 'Handles at chest height. Push, don''t bounce.', 'Chest, front of shoulders, triceps. A fixed path so you learn the push before dumbbells.'),
  ('gym', 'Chest-supported row', 'Chest stays on the pad the whole time.', 'Upper back. The pad takes your lower back out of it, so you can pull hard safely.'),
  ('gym', 'DB Romanian deadlift', 'Push your hips back. Soft knees. Feel it in your hamstrings.', 'Hamstrings and glutes. The hip hinge: the single most useful pattern in the gym.'),
  ('gym', 'DB bench press', 'Dumbbells over your chest. Lower slow, press up.', null),
  ('gym', 'DB shoulder press', 'Press straight up. Ribs down.', 'Shoulders and triceps. Pressing overhead with dumbbells lets each arm find its own path.'),
  ('gym', 'Dead bug', 'Lower back stays flat on the floor.', 'Deep core. Looks easy, isn''t. Keeps your lower back flat under load.'),
  ('gym', 'Dead bug, arms only', 'Legs stay up. Just the arms move.', null),
  ('gym', 'Farmer carry', 'Heavy dumbbells, walk tall, don''t lean.', 'Grip, core, upper back. Walking with heavy things is the oldest exercise there is.'),
  ('gym', 'Farmer carry, light', 'Lighter dumbbells. Same walk.', null),
  ('gym', 'Glute bridge', 'Feet flat, drive your hips up, squeeze.', null),
  ('gym', 'Goblet squat', 'Hold one dumbbell at your chest. Sit down between your feet.', 'Quads, glutes, core. Holding the weight in front keeps you upright and makes the squat easy to learn.'),
  ('gym', 'Hip hinge, no weight', 'Hands on hips, push them back to the wall behind you.', null),
  ('gym', 'Hip thrust', 'Shoulders on the bench. Squeeze at the top.', 'Glutes. The strongest muscle in your body, trained directly.'),
  ('gym', 'Incline DB press', 'Bench at 30°. Elbows slightly tucked.', 'Upper chest and shoulders. The angle hits what the flat press misses.'),
  ('gym', 'Incline push-up', 'Hands on a bench. Body straight.', null),
  ('gym', 'Knee plank', 'Knees down, hips in line.', null),
  ('gym', 'Lat pulldown', 'Pull the bar to your collarbone, not behind your head.', 'Lats and biceps. The pull-up, with as much help as you need.'),
  ('gym', 'Leg curl', 'Slow on the way back.', 'Hamstrings. Isolates the back of the leg so the hinge gets stronger.'),
  ('gym', 'Leg press', 'Feet shoulder-width. Don''t lock your knees at the top.', 'Quads and glutes. The safest way to load your legs on day one: the machine holds you, you push.'),
  ('gym', 'Leg press, short range', 'Stop before your knees pass 90°.', null),
  ('gym', 'Machine shoulder press', 'Seat so the handles start at ear height.', null),
  ('gym', 'Neutral-grip floor press', 'Palms facing each other. Elbows stop at the floor.', null),
  ('gym', 'Neutral-grip pulldown', 'Palms facing each other. Elbows to your ribs.', null),
  ('gym', 'One-arm DB row', 'Hand on a bench. Pull to your hip.', null),
  ('gym', 'Plank', 'Squeeze everything. Don''t let your hips sag.', 'Everything between your ribs and hips. Teaches you to brace, which every other lift needs.'),
  ('gym', 'Seated DB press, light', 'Half the weight. Full range.', null),
  ('gym', 'Seated row', 'Pull to your belly button. Shoulders down.', 'Upper back and biceps. Balances the pressing, and it''s what keeps your shoulders back at a desk.'),
  ('gym', 'Split squat', 'Back knee toward the floor. Front shin upright.', 'Quads and glutes, one leg at a time. Fixes the side that''s been coasting.'),
  ('gym', 'Step-up', 'Low box. Drive through the front heel.', null),
  ('gym', 'Suitcase carry', 'One dumbbell. Don''t lean away from it.', null)
on conflict (category, name) do nothing;

insert into template_movements (id, template_id, exercise_id, position, kind, rest_sec, per_side, cue_override) values
  ('8224a2cd-55f4-471a-969b-cc3fd69e7f54', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', (select id from exercises where category = 'gym' and name = 'Leg press'), 0, 'weight', 90, false, null),
  ('bedcfe22-ab93-4bcb-9daa-abae0a4d6bc4', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', (select id from exercises where category = 'gym' and name = 'Chest press machine'), 1, 'weight', 60, false, null),
  ('6c81a273-1374-4454-a49a-fa7717b2b6e0', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', (select id from exercises where category = 'gym' and name = 'Seated row'), 2, 'weight', 60, false, null),
  ('75cb579b-ecae-4c76-95b9-a9f811aa1b60', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', (select id from exercises where category = 'gym' and name = 'DB Romanian deadlift'), 3, 'weight', 90, false, null),
  ('1bffbd81-6505-4731-99b8-30301cd666b0', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', (select id from exercises where category = 'gym' and name = 'Plank'), 4, 'time', 45, false, null),
  ('cc8f2e3b-db78-43ef-b42b-8dad19921b48', '53c169e4-192f-41dc-b0c4-625e853251c6', (select id from exercises where category = 'gym' and name = 'Goblet squat'), 0, 'weight', 90, false, null),
  ('370fdaa9-b1ec-4cee-82ce-7396799ae4f1', '53c169e4-192f-41dc-b0c4-625e853251c6', (select id from exercises where category = 'gym' and name = 'Lat pulldown'), 1, 'weight', 60, false, null),
  ('8061a2bb-e7ee-4644-a11f-b580dbcaffe4', '53c169e4-192f-41dc-b0c4-625e853251c6', (select id from exercises where category = 'gym' and name = 'DB shoulder press'), 2, 'weight', 60, false, null),
  ('953ec9d3-7a09-4d4f-a8e7-063e82791384', '53c169e4-192f-41dc-b0c4-625e853251c6', (select id from exercises where category = 'gym' and name = 'Leg curl'), 3, 'weight', 60, false, null),
  ('66e7ef43-db8a-4439-91d3-b00207c729aa', '53c169e4-192f-41dc-b0c4-625e853251c6', (select id from exercises where category = 'gym' and name = 'Dead bug'), 4, 'reps', 45, false, null),
  ('fb1185d0-dd05-46c3-8560-908b7992e0ee', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', (select id from exercises where category = 'gym' and name = 'Hip thrust'), 0, 'weight', 90, false, null),
  ('77fae061-c6cd-4213-92d2-d4bfd07e4aa8', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', (select id from exercises where category = 'gym' and name = 'Incline DB press'), 1, 'weight', 60, false, null),
  ('9a655599-8223-4ad1-b915-e9f14d40dcfc', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', (select id from exercises where category = 'gym' and name = 'Chest-supported row'), 2, 'weight', 60, false, null),
  ('c9b3a120-d3e0-4141-98e7-b505d4b05125', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', (select id from exercises where category = 'gym' and name = 'Split squat'), 3, 'weight', 60, true, null),
  ('63b05814-ae67-4921-abbd-d926eca5ac1a', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', (select id from exercises where category = 'gym' and name = 'Farmer carry'), 4, 'time', 60, false, null)
on conflict (id) do nothing;

insert into movement_alternatives (template_movement_id, reason, pain_area, exercise_id, kind, per_side, cue_override) values
  ('8224a2cd-55f4-471a-969b-cc3fd69e7f54', 'swap', null, (select id from exercises where category = 'gym' and name = 'Goblet squat'), null, null, null),
  ('8224a2cd-55f4-471a-969b-cc3fd69e7f54', 'easier', null, (select id from exercises where category = 'gym' and name = 'Box squat'), 'reps', null, null),
  ('8224a2cd-55f4-471a-969b-cc3fd69e7f54', 'pain', 'knees', (select id from exercises where category = 'gym' and name = 'Leg curl'), null, null, null),
  ('bedcfe22-ab93-4bcb-9daa-abae0a4d6bc4', 'swap', null, (select id from exercises where category = 'gym' and name = 'DB bench press'), null, null, null),
  ('bedcfe22-ab93-4bcb-9daa-abae0a4d6bc4', 'easier', null, (select id from exercises where category = 'gym' and name = 'Incline push-up'), 'reps', null, null),
  ('bedcfe22-ab93-4bcb-9daa-abae0a4d6bc4', 'pain', 'shoulders', (select id from exercises where category = 'gym' and name = 'Neutral-grip floor press'), null, null, null),
  ('6c81a273-1374-4454-a49a-fa7717b2b6e0', 'swap', null, (select id from exercises where category = 'gym' and name = 'One-arm DB row'), null, null, null),
  ('6c81a273-1374-4454-a49a-fa7717b2b6e0', 'easier', null, (select id from exercises where category = 'gym' and name = 'Band row'), 'reps', null, null),
  ('6c81a273-1374-4454-a49a-fa7717b2b6e0', 'pain', 'back', (select id from exercises where category = 'gym' and name = 'Chest-supported row'), null, null, null),
  ('75cb579b-ecae-4c76-95b9-a9f811aa1b60', 'swap', null, (select id from exercises where category = 'gym' and name = 'Leg curl'), null, null, null),
  ('75cb579b-ecae-4c76-95b9-a9f811aa1b60', 'easier', null, (select id from exercises where category = 'gym' and name = 'Hip hinge, no weight'), 'reps', null, null),
  ('75cb579b-ecae-4c76-95b9-a9f811aa1b60', 'pain', 'back', (select id from exercises where category = 'gym' and name = 'Leg curl'), null, null, null),
  ('1bffbd81-6505-4731-99b8-30301cd666b0', 'easier', null, (select id from exercises where category = 'gym' and name = 'Knee plank'), 'time', null, null),
  ('1bffbd81-6505-4731-99b8-30301cd666b0', 'pain', 'shoulders', (select id from exercises where category = 'gym' and name = 'Dead bug'), 'reps', null, null),
  ('cc8f2e3b-db78-43ef-b42b-8dad19921b48', 'swap', null, (select id from exercises where category = 'gym' and name = 'Leg press'), null, null, null),
  ('cc8f2e3b-db78-43ef-b42b-8dad19921b48', 'easier', null, (select id from exercises where category = 'gym' and name = 'Box squat'), 'reps', null, null),
  ('cc8f2e3b-db78-43ef-b42b-8dad19921b48', 'pain', 'knees', (select id from exercises where category = 'gym' and name = 'Leg press, short range'), null, null, null),
  ('370fdaa9-b1ec-4cee-82ce-7396799ae4f1', 'swap', null, (select id from exercises where category = 'gym' and name = 'Assisted pull-up'), null, null, null),
  ('370fdaa9-b1ec-4cee-82ce-7396799ae4f1', 'easier', null, (select id from exercises where category = 'gym' and name = 'Band pulldown'), 'reps', null, null),
  ('370fdaa9-b1ec-4cee-82ce-7396799ae4f1', 'pain', 'shoulders', (select id from exercises where category = 'gym' and name = 'Neutral-grip pulldown'), null, null, null),
  ('8061a2bb-e7ee-4644-a11f-b580dbcaffe4', 'swap', null, (select id from exercises where category = 'gym' and name = 'Machine shoulder press'), null, null, null),
  ('8061a2bb-e7ee-4644-a11f-b580dbcaffe4', 'easier', null, (select id from exercises where category = 'gym' and name = 'Seated DB press, light'), 'weight', null, null),
  ('8061a2bb-e7ee-4644-a11f-b580dbcaffe4', 'pain', 'shoulders', (select id from exercises where category = 'gym' and name = 'Incline DB press'), null, null, null),
  ('953ec9d3-7a09-4d4f-a8e7-063e82791384', 'swap', null, (select id from exercises where category = 'gym' and name = 'DB Romanian deadlift'), null, null, 'Push your hips back. Soft knees.'),
  ('953ec9d3-7a09-4d4f-a8e7-063e82791384', 'easier', null, (select id from exercises where category = 'gym' and name = 'Glute bridge'), 'reps', null, null),
  ('953ec9d3-7a09-4d4f-a8e7-063e82791384', 'pain', 'knees', (select id from exercises where category = 'gym' and name = 'Glute bridge'), 'reps', null, null),
  ('66e7ef43-db8a-4439-91d3-b00207c729aa', 'easier', null, (select id from exercises where category = 'gym' and name = 'Dead bug, arms only'), 'reps', null, null),
  ('66e7ef43-db8a-4439-91d3-b00207c729aa', 'pain', 'back', (select id from exercises where category = 'gym' and name = 'Bird dog'), 'reps', null, null),
  ('fb1185d0-dd05-46c3-8560-908b7992e0ee', 'swap', null, (select id from exercises where category = 'gym' and name = 'Glute bridge'), null, null, null),
  ('fb1185d0-dd05-46c3-8560-908b7992e0ee', 'easier', null, (select id from exercises where category = 'gym' and name = 'Glute bridge'), 'reps', null, null),
  ('fb1185d0-dd05-46c3-8560-908b7992e0ee', 'pain', 'back', (select id from exercises where category = 'gym' and name = 'Glute bridge'), 'reps', null, null),
  ('77fae061-c6cd-4213-92d2-d4bfd07e4aa8', 'swap', null, (select id from exercises where category = 'gym' and name = 'Chest press machine'), null, null, null),
  ('77fae061-c6cd-4213-92d2-d4bfd07e4aa8', 'easier', null, (select id from exercises where category = 'gym' and name = 'Incline push-up'), 'reps', null, null),
  ('77fae061-c6cd-4213-92d2-d4bfd07e4aa8', 'pain', 'shoulders', (select id from exercises where category = 'gym' and name = 'Neutral-grip floor press'), null, null, null),
  ('9a655599-8223-4ad1-b915-e9f14d40dcfc', 'swap', null, (select id from exercises where category = 'gym' and name = 'Seated row'), null, null, null),
  ('9a655599-8223-4ad1-b915-e9f14d40dcfc', 'easier', null, (select id from exercises where category = 'gym' and name = 'Band row'), 'reps', null, null),
  ('9a655599-8223-4ad1-b915-e9f14d40dcfc', 'pain', 'back', (select id from exercises where category = 'gym' and name = 'Seated row'), null, null, null),
  ('c9b3a120-d3e0-4141-98e7-b505d4b05125', 'swap', null, (select id from exercises where category = 'gym' and name = 'Leg press'), null, false, null),
  ('c9b3a120-d3e0-4141-98e7-b505d4b05125', 'easier', null, (select id from exercises where category = 'gym' and name = 'Step-up'), 'reps', true, null),
  ('c9b3a120-d3e0-4141-98e7-b505d4b05125', 'pain', 'knees', (select id from exercises where category = 'gym' and name = 'Leg press, short range'), null, false, null),
  ('63b05814-ae67-4921-abbd-d926eca5ac1a', 'easier', null, (select id from exercises where category = 'gym' and name = 'Farmer carry, light'), 'time', null, null),
  ('63b05814-ae67-4921-abbd-d926eca5ac1a', 'pain', 'back', (select id from exercises where category = 'gym' and name = 'Suitcase carry'), 'time', null, null)
on conflict (template_movement_id, reason, coalesce(pain_area, '')) do nothing;

-- Placeholder shop seed — see migration 012 for provenance.
insert into shop_items (id, category, section, name, blurb, link, sort_order) values
  ('7d3f9c1e-1a2b-4c3d-9e5f-6a7b8c9d0e01', 'gym', 'gear', 'Training shoes', 'Flat, stable soles for lifting days.', null, 0),
  ('7d3f9c1e-1a2b-4c3d-9e5f-6a7b8c9d0e02', 'gym', 'gear', 'Exercise mat', 'For the home programs. Floor work stops hurting your knees.', null, 1)
on conflict (id) do nothing;
