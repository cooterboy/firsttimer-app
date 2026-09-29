-- Moves workout content (which programs exist, what a training day looks like,
-- and every movement's cue/swap/easier-version/pain-substitution/video) out of
-- lib/gymProgram.ts's hardcoded GYM constant into real tables, so adding Hyrox
-- later — or fixing a cue, or dropping in a video URL — is an INSERT/UPDATE,
-- not a redeploy.
--
-- Naming note: this is NOT the same "sessions" table as logged workout history
-- (that one already exists — one row per session a user actually did). This is
-- the content/template layer: "what a Session A/B/C IS," not "what you did."
-- Called `session_templates` here specifically to avoid colliding with it.
--
-- These three tables are shared reference content, not per-user data — every
-- signed-in user reads the same rows. RLS still applies (nothing is public to
-- anonymous requests), but the policy is read-for-anyone-authenticated rather
-- than self-owned. There's no insert/update/delete policy for regular users:
-- editing this content is meant to happen in the Supabase dashboard's Table
-- Editor (service-role access, bypasses RLS), not from the app.

create table if not exists programs (
  category text primary key,
  name text not null,
  sub text not null default '',
  live boolean not null default false
);

alter table programs enable row level security;

drop policy if exists "programs_select" on programs;

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

drop policy if exists "session_templates_select" on session_templates;

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

drop policy if exists "movements_select" on movements;

create policy "movements_select"
on movements
for select
using (auth.role() = 'authenticated');

-- Seed data for the gym program — generated from lib/gymProgram.ts's GYM constant.
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
