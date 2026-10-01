-- Media for exercises, block ranges for session slots, and the two Storage buckets
-- the media lives in — so a picture, a clip, or a block-specific movement is a
-- Table Editor / Storage upload, not a code change.
--
-- 1. exercises.image_url — a still / thumbnail, next to the existing video_url.
--    Both hold a FULL URL (the Storage public URL today), not a bucket path, so
--    moving video to Bunny.net or Cloudflare Stream later is a data edit.
--
-- 2. template_movements.block_from / block_to — the blocks a slot appears in.
--    Null means unbounded on that side, so a slot with both null (every existing
--    row) runs in every block, as now. "From block 3 the first movement swaps" is
--    then one slot ending at block 2 and a replacement starting at block 3.
--
--    Sets and reps are deliberately NOT stored here: they come from each
--    person's session length and rep style plus the block (lib/gymProgram.ts).
--    Per-slot overrides go in template_movements.params.
--
--    NOTE: the app does not read block_from / block_to yet. Leave them empty
--    until it does — set one now and the app would show both the old and the
--    replacement movement in every block.
--
-- 3. Storage buckets, public-read: exercise-images (JPEG/PNG/WebP, 1 MB max) and
--    exercise-videos (MP4, 15 MB max — a 20-second 720p clip with no audio is
--    roughly 2–6 MB). Public means anyone with a file's URL can view it, which is
--    fine for movement demos. No storage policies are added, so the app can't
--    upload or change anything; uploads happen in the dashboard, which bypasses
--    row-level security.
--
-- Safe to paste more than once.

alter table exercises
  add column if not exists image_url text;

alter table template_movements
  add column if not exists block_from int,
  add column if not exists block_to int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'template_movements_block_range_check') then
    alter table template_movements add constraint template_movements_block_range_check check (
      (block_from is null or block_from >= 1)
      and (block_to is null or block_to >= 1)
      and (block_from is null or block_to is null or block_to >= block_from)
    );
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('exercise-images', 'exercise-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('exercise-videos', 'exercise-videos', true, 15728640, array['video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
