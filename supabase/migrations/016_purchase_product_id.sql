-- Block purchases become non-consumable store products, each unlocking specific
-- blocks (lib/blockCatalog.ts: gym_block_02 … gym_block_12, and bundles
-- gym_bundle_02_04 / 05_07 / 08_10). Ownership is worked out from which products
-- an account owns, so each purchase row now records its product.
--
-- product_id is null on rows written before this migration; the app keeps
-- reading those by their `blocks` count, as before (ownedBlocks()).
--
-- A non-consumable can be owned once per account, so one row per product per
-- account. The app already writes a deterministic id per (account, product), so
-- a repeated save upserts onto the same row; this constraint is the database's
-- own guarantee of that. Null product_ids don't collide (nulls are distinct).
--
-- Safe to paste more than once.

alter table purchases
  add column if not exists product_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchases_user_product_key') then
    alter table purchases add constraint purchases_user_product_key unique (user_id, product_id);
  end if;
end $$;
