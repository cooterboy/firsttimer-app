-- Drops 009's `movements` table. Migration 014 moved every row into
-- template_movements / movement_alternatives / exercises, and the app has read
-- only those since the step that switched lib/sync.ts's fetchProgramContent over.
-- Its select policy goes with it.
--
-- Run only after 013 and 014, and after confirming on a phone that the app loads
-- its program from the new tables (no "Program content fetch failed" warning).
--
-- Refuses to drop anything 014 didn't carry over: every 009 row must exist as a
-- template_movements row with the same id. Safe to paste more than once — once
-- the table is gone this is a no-op.

begin;

do $$
declare
  missing int;
begin
  if to_regclass('public.movements') is null then
    raise notice 'movements is already gone — nothing to do.';
    return;
  end if;

  if to_regclass('public.template_movements') is null then
    raise exception 'template_movements does not exist — run migrations 013 and 014 first';
  end if;

  select count(*) into missing
  from movements m
  where not exists (select 1 from template_movements tm where tm.id = m.id);

  if missing > 0 then
    raise exception '% movements rows were never moved into template_movements — run migration 014 first', missing;
  end if;

  drop table movements;
end $$;

commit;
