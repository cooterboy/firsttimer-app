-- Shop content as data (same pattern as migration 009's programs/session_templates/
-- movements): a shop_items table so gear and box-reorder items can be added with an
-- INSERT, not a redeploy. No real brand deals exist yet, so this ships with the table
-- empty of "in_your_box" rows and just 1-2 placeholder "gear" rows — the shell, not
-- fake content. Shared reference content, not per-user data, so it uses the same
-- read-for-anyone-authenticated policy as programs/movements, not a self-owned one.

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

drop policy if exists "shop_items_select" on shop_items;

create policy "shop_items_select"
on shop_items
for select
using (auth.role() = 'authenticated');

-- Placeholder seed — link is null (no affiliate accounts approved yet), matching the
-- existing "not yet connected" pattern rather than presenting fake data as real.
insert into shop_items (id, category, section, name, blurb, link, sort_order) values
  ('7d3f9c1e-1a2b-4c3d-9e5f-6a7b8c9d0e01', 'gym', 'gear', 'Training shoes', 'Flat, stable soles for lifting days.', null, 0),
  ('7d3f9c1e-1a2b-4c3d-9e5f-6a7b8c9d0e02', 'gym', 'gear', 'Exercise mat', 'For the home programs. Floor work stops hurting your knees.', null, 1)
on conflict (id) do nothing;
