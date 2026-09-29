-- Restructures migration 009's content tables so a new category (hyrox, marathon)
-- or a new plan within one (a home program, a second hyrox plan) is an INSERT,
-- never another migration. 009's shape couldn't do that: `programs` was keyed by
-- category (one plan per category, ever), sessions were letters the app rotated
-- with `% 3`, movement columns only described strength work, and every swap/easier/
-- pain alternative was a jsonb copy of another movement's text.
--
--   categories             gym / hyrox / marathon — 009's `programs`, renamed
--     programs             a plan within a category (new)
--       session_templates  "what Session A is" — 009's table, converted in place
--         template_movements     one exercise slot in a session (new)
--           movement_alternatives  swap / easier / pain for that slot (new)
--   exercises              one row per exercise per category: cue, why, video (new)
--
-- Deliberately no enums or CHECK lists on category-ish values (kind, reason,
-- where_key, pain_area): adding a value to one of those is itself a migration.
-- Category is a foreign key to a lookup table instead, and category-specific
-- prescription (distance, pace, station) goes in template_movements.params.
--
-- This migration is structure only. The gym content still lives in 009's
-- `movements` table, which is left untouched here as the source for the data move
-- (migration 014) and dropped in a later migration once the app reads the new
-- tables. Until then, the installed app's content fetch fails cleanly (it filters
-- session_templates by the `category` column dropped below) and falls back to its
-- cached copy / lib/gymProgram.ts's GYM constant — the same path as being offline.
--
-- Same RLS pattern as 009: read for anyone signed in, no write policies — content
-- is edited in the dashboard's Table Editor. New tables get uuid defaults so rows
-- can be added there without generating ids by hand.
--
-- Safe to paste more than once: every conversion step checks whether it's already
-- been done, and the whole thing runs in one transaction.

begin;

-- 1. 009's programs → categories. Its FKs (session_templates.category,
--    movements.category) follow the rename automatically. The primary key index is
--    renamed too, because the new `programs` table below needs `programs_pkey`.
do $$
begin
  if to_regclass('public.categories') is null then
    alter table programs rename to categories;
    alter table categories rename column category to key;
    alter index programs_pkey rename to categories_pkey;
    alter policy "programs_select" on categories rename to "categories_select";

    alter table categories add column sort_order int not null default 0;
    update categories set sort_order = case key
      when 'gym' then 0
      when 'hyrox' then 1
      when 'marathon' then 2
      else 99
    end;
  end if;
end $$;

-- 2. programs: a plan within a category — gym, home with dumbbells, home with
--    nothing are each their own row with entirely their own sessions.
--
--    where_keys: every profile `where` this plan serves. One plan serves several
--    places, as in the prototype's SETS map (garage → the gym plan, hotel → home
--    dumbbells, outside → home no-equipment). The app picks the lowest sort_order
--    live plan whose where_keys contains the person's `where`, falling back to the
--    gym plan (the prototype's `SETS[where] || GYM`). No uniqueness on it — two
--    plans for the same place (e.g. two hyrox plans) is the point.
--
--    live: false while a plan is being built row by row in the Table Editor, so
--    nobody gets a half-written program. Flip it once the plan is complete.
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

drop policy if exists "programs_select" on programs;

create policy "programs_select"
on programs
for select
using (auth.role() = 'authenticated');

insert into programs (id, category, where_keys, name, block_sessions, live, sort_order) values
  ('gym', 'gym', '{gym,garage}', 'Gym', 24, true, 0)
on conflict (id) do nothing;

-- 3. session_templates, converted in place (ids kept — nothing else changes about
--    Session A/B/C): category → program_id, letter → code, order_index → position.
--    Rotation becomes "next template by position", not LETTERS[idx % 3].
alter table session_templates
  add column if not exists program_id text references programs (id) on delete cascade;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'session_templates' and column_name = 'category'
  ) then
    update session_templates set program_id = 'gym' where category = 'gym' and program_id is null;
    if exists (select 1 from session_templates where program_id is null) then
      raise exception 'session_templates has non-gym rows with no program to attach them to';
    end if;
    alter table session_templates drop column category;
    alter table session_templates rename column letter to code;
    alter table session_templates rename column order_index to position;
  end if;
end $$;

alter table session_templates alter column program_id set not null;
alter table session_templates alter column id set default gen_random_uuid();

-- code is stored in logged history, so it must be unique within a program.
-- position deliberately isn't unique: swapping two rows' positions one at a time
-- in the Table Editor would trip it.
create unique index if not exists session_templates_program_code_idx on session_templates (program_id, code);
create index if not exists session_templates_program_position_idx on session_templates (program_id, position);

-- 4. exercises: one row per exercise, shared by every slot and alternative that
--    uses it — so a video or "why" line is set once, not once per appearance.
--    Logged history keys lifts by exercise *name*: renaming a row here splits that
--    lift's history in two. Fix wording in `cue`, not `name`.
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

drop policy if exists "exercises_select" on exercises;

create policy "exercises_select"
on exercises
for select
using (auth.role() = 'authenticated');

-- 5. template_movements: one exercise slot in a session. kind is 'weight' | 'reps' |
--    'time' for gym today; other categories add their own values freely. params
--    holds category-specific prescription and stays '{}' for gym. cue_override
--    exists for context-specific wording (e.g. a shorter cue when an exercise
--    appears as someone else's swap) — null means use exercises.cue.
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

drop policy if exists "template_movements_select" on template_movements;

create policy "template_movements_select"
on template_movements
for select
using (auth.role() = 'authenticated');

-- 6. movement_alternatives: the app's answers to "the machine is taken" (swap),
--    "this is too hard" (easier) and "this hurts" (pain, one per pain_area).
--    kind / per_side / cue_override null = inherit from the slot, matching the
--    prototype's `alt.type || m.type`.
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

-- One swap, one easier, and one per pain area, per slot. coalesce because a plain
-- unique constraint treats null pain_areas as distinct.
create unique index if not exists movement_alternatives_one_per_reason_idx
  on movement_alternatives (template_movement_id, reason, coalesce(pain_area, ''));

alter table movement_alternatives enable row level security;

drop policy if exists "movement_alternatives_select" on movement_alternatives;

create policy "movement_alternatives_select"
on movement_alternatives
for select
using (auth.role() = 'authenticated');

commit;
