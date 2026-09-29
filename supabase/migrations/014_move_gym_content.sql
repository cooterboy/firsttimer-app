-- Moves the gym content from 009's `movements` table into 013's structure. Reads
-- the live rows rather than re-seeding from lib/gymProgram.ts, so anything edited
-- in the Table Editor since 009 (a cue fix, a video_url) carries over.
--
-- Exercise identity is (category, name). Each exercise's default cue is the one it
-- has as a main movement in a session — the full version — falling back to its
-- most common wording as an alternative. Any appearance whose cue differs keeps
-- its own wording in cue_override; today that's exactly one: DB Romanian
-- deadlift's shorter "Push your hips back. Soft knees." as Leg curl's swap.
--
-- template_movements reuses 009's movement ids, so a slot keeps its id across the
-- move. Alternatives inherit kind/per_side from their slot when 009's jsonb didn't
-- set them — the same `alt.type || m.type` fallback the app already applies.
--
-- Also moves lib/gymProgram.ts's MUSCLES ("what this works" in the movement
-- sheet) into exercises.why, copy verbatim.
--
-- Safe to paste more than once: every insert skips rows that already exist, and
-- `why` is only filled where empty, so a rerun never overwrites dashboard edits.
-- Checks its own row counts before committing and aborts if anything was dropped.

begin;

do $$
declare
  expected_slots int;
  expected_alts int;
  actual_slots int;
  actual_alts int;
begin
  if to_regclass('public.movements') is null then
    raise notice '009''s movements table is gone — content already moved, nothing to do.';
    return;
  end if;

  -- Every place an exercise name appears, with the cue it has there.
  -- is_main_rank = 0 for a session's own movement, 1 for a swap/easier/pain
  -- alternative, so a main-slot cue wins when picking the default below.
  create temporary table _occurrences on commit drop as
    select m.category, m.n as name, m.cue, 0 as is_main_rank
    from movements m
    union all
    select m.category, m.sub->>'n', m.sub->>'cue', 1
    from movements m where jsonb_typeof(m.sub) = 'object'
    union all
    select m.category, m.easier->>'n', m.easier->>'cue', 1
    from movements m where jsonb_typeof(m.easier) = 'object'
    union all
    select m.category, p.value->>'n', p.value->>'cue', 1
    from movements m, jsonb_each(m.pain) p where jsonb_typeof(m.pain) = 'object';

  -- 1. exercises
  insert into exercises (category, name, cue)
  select distinct on (category, name) category, name, cue
  from (
    select category, name, cue, min(is_main_rank) as rank, count(*) as uses
    from _occurrences
    group by category, name, cue
  ) c
  order by category, name, rank, uses desc, cue
  on conflict (category, name) do nothing;

  -- 009 kept video_url per slot; an exercise gets its main slot's clip.
  update exercises e
  set video_url = v.video_url
  from (
    select category, n, max(video_url) as video_url
    from movements
    where video_url is not null
    group by category, n
  ) v
  where e.category = v.category and e.name = v.n and e.video_url is null;

  -- 2. template_movements — one per 009 movement row, same id.
  insert into template_movements (id, template_id, exercise_id, position, kind, rest_sec, per_side, cue_override)
  select
    m.id,
    m.session_template_id,
    e.id,
    m.order_index,
    m.type,
    m.rest,
    m.per_side,
    nullif(m.cue, e.cue)
  from movements m
  join exercises e on e.category = m.category and e.name = m.n
  on conflict (id) do nothing;

  -- 3. movement_alternatives — sub → swap, easier → easier, pain.{area} → pain.
  insert into movement_alternatives (template_movement_id, reason, pain_area, exercise_id, kind, per_side, cue_override)
  select a.slot_id, a.reason, a.pain_area, e.id, a.alt->>'type', (a.alt->>'perSide')::boolean, nullif(a.alt->>'cue', e.cue)
  from (
    select m.id as slot_id, m.category, 'swap' as reason, null::text as pain_area, m.sub as alt
    from movements m where jsonb_typeof(m.sub) = 'object'
    union all
    select m.id, m.category, 'easier', null, m.easier
    from movements m where jsonb_typeof(m.easier) = 'object'
    union all
    select m.id, m.category, 'pain', p.key, p.value
    from movements m, jsonb_each(m.pain) p where jsonb_typeof(m.pain) = 'object'
  ) a
  join exercises e on e.category = a.category and e.name = a.alt->>'n'
  on conflict (template_movement_id, reason, coalesce(pain_area, '')) do nothing;

  -- Nothing silently dropped: every 009 movement became a slot, and every
  -- sub/easier/pain entry became an alternative.
  select count(*) into expected_slots from movements;
  select count(*) into actual_slots from template_movements tm where tm.id in (select id from movements);

  select
    count(*) filter (where jsonb_typeof(sub) = 'object')
    + count(*) filter (where jsonb_typeof(easier) = 'object')
    + coalesce(sum((select count(*) from jsonb_object_keys(pain))) filter (where jsonb_typeof(pain) = 'object'), 0)
  into expected_alts
  from movements;
  select count(*) into actual_alts
  from movement_alternatives where template_movement_id in (select id from movements);

  if actual_slots <> expected_slots or actual_alts <> expected_alts then
    raise exception 'content move incomplete: % of % slots, % of % alternatives',
      actual_slots, expected_slots, actual_alts, expected_alts;
  end if;
end $$;

-- 4. MUSCLES → exercises.why, verbatim from lib/gymProgram.ts.
update exercises e
set why = v.why
from (values
    ('Leg press', 'Quads and glutes. The safest way to load your legs on day one: the machine holds you, you push.'),
    ('Chest press machine', 'Chest, front of shoulders, triceps. A fixed path so you learn the push before dumbbells.'),
    ('Seated row', 'Upper back and biceps. Balances the pressing, and it''s what keeps your shoulders back at a desk.'),
    ('DB Romanian deadlift', 'Hamstrings and glutes. The hip hinge: the single most useful pattern in the gym.'),
    ('Plank', 'Everything between your ribs and hips. Teaches you to brace, which every other lift needs.'),
    ('Goblet squat', 'Quads, glutes, core. Holding the weight in front keeps you upright and makes the squat easy to learn.'),
    ('Lat pulldown', 'Lats and biceps. The pull-up, with as much help as you need.'),
    ('DB shoulder press', 'Shoulders and triceps. Pressing overhead with dumbbells lets each arm find its own path.'),
    ('Leg curl', 'Hamstrings. Isolates the back of the leg so the hinge gets stronger.'),
    ('Dead bug', 'Deep core. Looks easy, isn''t. Keeps your lower back flat under load.'),
    ('Hip thrust', 'Glutes. The strongest muscle in your body, trained directly.'),
    ('Incline DB press', 'Upper chest and shoulders. The angle hits what the flat press misses.'),
    ('Chest-supported row', 'Upper back. The pad takes your lower back out of it, so you can pull hard safely.'),
    ('Split squat', 'Quads and glutes, one leg at a time. Fixes the side that''s been coasting.'),
    ('Farmer carry', 'Grip, core, upper back. Walking with heavy things is the oldest exercise there is.')
) as v (name, why)
where e.category = 'gym' and e.name = v.name and e.why is null;

commit;
