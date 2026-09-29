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
  date timestamptz not null default now()
);

alter table purchases enable row level security;

create policy "purchases are self-owned" on purchases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Content-as-data (migration 009): which programs exist, what a training day looks
-- like, and every movement's cue/swap/easier-version/pain-substitution/video. Shared
-- reference content, not per-user data — read-for-anyone-authenticated, no
-- insert/update/delete policy for regular users (edited via the Table Editor).
create table if not exists programs (
  category text primary key,
  name text not null,
  sub text not null default '',
  live boolean not null default false
);

alter table programs enable row level security;

create policy "programs_select"
on programs
for select
using (auth.role() = 'authenticated');

create table if not exists session_templates (
  id uuid primary key,
  category text not null references programs (category) on delete cascade,
  letter text not null,
  label text not null default '',
  order_index int not null default 0
);

alter table session_templates enable row level security;

create policy "session_templates_select"
on session_templates
for select
using (auth.role() = 'authenticated');

create table if not exists movements (
  id uuid primary key,
  category text not null references programs (category) on delete cascade,
  session_template_id uuid not null references session_templates (id) on delete cascade,
  order_index int not null default 0,
  n text not null,
  cue text not null,
  type text not null default 'weight',
  rest int not null default 60,
  per_side boolean not null default false,
  sub jsonb,
  easier jsonb,
  pain jsonb,
  video_url text
);

alter table movements enable row level security;

create policy "movements_select"
on movements
for select
using (auth.role() = 'authenticated');

-- Shop content as data (migration 012): gear/box-reorder items, same
-- shared-content RLS pattern as programs/movements above.
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

-- Seed data for the gym program — see migration 009 for provenance.
insert into programs (category, name, sub, live) values
  ('gym', 'Gym', '24 sessions a block · strength', true),
  ('hyrox', 'Hyrox', '12 weeks to race day', false),
  ('marathon', 'Marathon prep', '16 weeks, one long run at a time', false)
on conflict (category) do nothing;

insert into session_templates (id, category, letter, label, order_index) values
  ('b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 'gym', 'A', 'Session A', 0),
  ('53c169e4-192f-41dc-b0c4-625e853251c6', 'gym', 'B', 'Session B', 1),
  ('b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 'gym', 'C', 'Session C', 2)
on conflict (id) do nothing;

insert into movements (id, category, session_template_id, order_index, n, cue, type, rest, per_side, sub, easier, pain, video_url) values
  ('8224a2cd-55f4-471a-969b-cc3fd69e7f54', 'gym', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 0, 'Leg press', 'Feet shoulder-width. Don''t lock your knees at the top.', 'weight', 90, false, '{"n":"Goblet squat","cue":"Hold one dumbbell at your chest. Sit down between your feet."}'::jsonb, '{"n":"Box squat","cue":"Sit back to a bench, stand up. No weight.","type":"reps"}'::jsonb, '{"knees":{"n":"Leg curl","cue":"Slow on the way back."}}'::jsonb, null),
  ('bedcfe22-ab93-4bcb-9daa-abae0a4d6bc4', 'gym', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 1, 'Chest press machine', 'Handles at chest height. Push, don''t bounce.', 'weight', 60, false, '{"n":"DB bench press","cue":"Dumbbells over your chest. Lower slow, press up."}'::jsonb, '{"n":"Incline push-up","cue":"Hands on a bench. Body straight.","type":"reps"}'::jsonb, '{"shoulders":{"n":"Neutral-grip floor press","cue":"Palms facing each other. Elbows stop at the floor."}}'::jsonb, null),
  ('6c81a273-1374-4454-a49a-fa7717b2b6e0', 'gym', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 2, 'Seated row', 'Pull to your belly button. Shoulders down.', 'weight', 60, false, '{"n":"One-arm DB row","cue":"Hand on a bench. Pull to your hip."}'::jsonb, '{"n":"Band row","cue":"Band around a post. Squeeze your shoulder blades.","type":"reps"}'::jsonb, '{"back":{"n":"Chest-supported row","cue":"Chest stays on the pad the whole time."}}'::jsonb, null),
  ('75cb579b-ecae-4c76-95b9-a9f811aa1b60', 'gym', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 3, 'DB Romanian deadlift', 'Push your hips back. Soft knees. Feel it in your hamstrings.', 'weight', 90, false, '{"n":"Leg curl","cue":"Slow on the way back."}'::jsonb, '{"n":"Hip hinge, no weight","cue":"Hands on hips, push them back to the wall behind you.","type":"reps"}'::jsonb, '{"back":{"n":"Leg curl","cue":"Slow on the way back."}}'::jsonb, null),
  ('1bffbd81-6505-4731-99b8-30301cd666b0', 'gym', 'b6d2d517-aafb-4d0c-bfc4-e93c0ce44d32', 4, 'Plank', 'Squeeze everything. Don''t let your hips sag.', 'time', 45, false, null, '{"n":"Knee plank","cue":"Knees down, hips in line.","type":"time"}'::jsonb, '{"shoulders":{"n":"Dead bug","cue":"Lower back stays flat on the floor.","type":"reps"}}'::jsonb, null),
  ('cc8f2e3b-db78-43ef-b42b-8dad19921b48', 'gym', '53c169e4-192f-41dc-b0c4-625e853251c6', 0, 'Goblet squat', 'Hold one dumbbell at your chest. Sit down between your feet.', 'weight', 90, false, '{"n":"Leg press","cue":"Feet shoulder-width. Don''t lock your knees at the top."}'::jsonb, '{"n":"Box squat","cue":"Sit back to a bench, stand up. No weight.","type":"reps"}'::jsonb, '{"knees":{"n":"Leg press, short range","cue":"Stop before your knees pass 90°."}}'::jsonb, null),
  ('370fdaa9-b1ec-4cee-82ce-7396799ae4f1', 'gym', '53c169e4-192f-41dc-b0c4-625e853251c6', 1, 'Lat pulldown', 'Pull the bar to your collarbone, not behind your head.', 'weight', 60, false, '{"n":"Assisted pull-up","cue":"Knees on the pad. Pull your chest to the bar."}'::jsonb, '{"n":"Band pulldown","cue":"Band over a bar. Pull to your chest.","type":"reps"}'::jsonb, '{"shoulders":{"n":"Neutral-grip pulldown","cue":"Palms facing each other. Elbows to your ribs."}}'::jsonb, null),
  ('8061a2bb-e7ee-4644-a11f-b580dbcaffe4', 'gym', '53c169e4-192f-41dc-b0c4-625e853251c6', 2, 'DB shoulder press', 'Press straight up. Ribs down.', 'weight', 60, false, '{"n":"Machine shoulder press","cue":"Seat so the handles start at ear height."}'::jsonb, '{"n":"Seated DB press, light","cue":"Half the weight. Full range.","type":"weight"}'::jsonb, '{"shoulders":{"n":"Incline DB press","cue":"Bench at 30°. Elbows slightly tucked."}}'::jsonb, null),
  ('953ec9d3-7a09-4d4f-a8e7-063e82791384', 'gym', '53c169e4-192f-41dc-b0c4-625e853251c6', 3, 'Leg curl', 'Slow on the way back.', 'weight', 60, false, '{"n":"DB Romanian deadlift","cue":"Push your hips back. Soft knees."}'::jsonb, '{"n":"Glute bridge","cue":"Feet flat, drive your hips up, squeeze.","type":"reps"}'::jsonb, '{"knees":{"n":"Glute bridge","cue":"Feet flat, drive your hips up, squeeze.","type":"reps"}}'::jsonb, null),
  ('66e7ef43-db8a-4439-91d3-b00207c729aa', 'gym', '53c169e4-192f-41dc-b0c4-625e853251c6', 4, 'Dead bug', 'Lower back stays flat on the floor.', 'reps', 45, false, null, '{"n":"Dead bug, arms only","cue":"Legs stay up. Just the arms move.","type":"reps"}'::jsonb, '{"back":{"n":"Bird dog","cue":"Opposite arm and leg. Hold two seconds.","type":"reps"}}'::jsonb, null),
  ('fb1185d0-dd05-46c3-8560-908b7992e0ee', 'gym', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 0, 'Hip thrust', 'Shoulders on the bench. Squeeze at the top.', 'weight', 90, false, '{"n":"Glute bridge","cue":"Feet flat, drive your hips up, squeeze."}'::jsonb, '{"n":"Glute bridge","cue":"Feet flat, drive your hips up, squeeze.","type":"reps"}'::jsonb, '{"back":{"n":"Glute bridge","cue":"Feet flat, drive your hips up, squeeze.","type":"reps"}}'::jsonb, null),
  ('77fae061-c6cd-4213-92d2-d4bfd07e4aa8', 'gym', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 1, 'Incline DB press', 'Bench at 30°. Elbows slightly tucked.', 'weight', 60, false, '{"n":"Chest press machine","cue":"Handles at chest height. Push, don''t bounce."}'::jsonb, '{"n":"Incline push-up","cue":"Hands on a bench. Body straight.","type":"reps"}'::jsonb, '{"shoulders":{"n":"Neutral-grip floor press","cue":"Palms facing each other. Elbows stop at the floor."}}'::jsonb, null),
  ('9a655599-8223-4ad1-b915-e9f14d40dcfc', 'gym', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 2, 'Chest-supported row', 'Chest stays on the pad the whole time.', 'weight', 60, false, '{"n":"Seated row","cue":"Pull to your belly button. Shoulders down."}'::jsonb, '{"n":"Band row","cue":"Band around a post. Squeeze your shoulder blades.","type":"reps"}'::jsonb, '{"back":{"n":"Seated row","cue":"Pull to your belly button. Shoulders down."}}'::jsonb, null),
  ('c9b3a120-d3e0-4141-98e7-b505d4b05125', 'gym', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 3, 'Split squat', 'Back knee toward the floor. Front shin upright.', 'weight', 60, true, '{"n":"Leg press","cue":"Feet shoulder-width. Don''t lock your knees at the top.","perSide":false}'::jsonb, '{"n":"Step-up","cue":"Low box. Drive through the front heel.","type":"reps","perSide":true}'::jsonb, '{"knees":{"n":"Leg press, short range","cue":"Stop before your knees pass 90°.","perSide":false}}'::jsonb, null),
  ('63b05814-ae67-4921-abbd-d926eca5ac1a', 'gym', 'b033921f-bf4b-481c-9f94-a9ba4e8af1d4', 4, 'Farmer carry', 'Heavy dumbbells, walk tall, don''t lean.', 'time', 60, false, null, '{"n":"Farmer carry, light","cue":"Lighter dumbbells. Same walk.","type":"time"}'::jsonb, '{"back":{"n":"Suitcase carry","cue":"One dumbbell. Don''t lean away from it.","type":"time"}}'::jsonb, null)
on conflict (id) do nothing;

-- Placeholder shop seed — see migration 012 for provenance.
insert into shop_items (id, category, section, name, blurb, link, sort_order) values
  ('7d3f9c1e-1a2b-4c3d-9e5f-6a7b8c9d0e01', 'gym', 'gear', 'Training shoes', 'Flat, stable soles for lifting days.', null, 0),
  ('7d3f9c1e-1a2b-4c3d-9e5f-6a7b8c9d0e02', 'gym', 'gear', 'Exercise mat', 'For the home programs. Floor work stops hurting your knees.', null, 1)
on conflict (id) do nothing;
