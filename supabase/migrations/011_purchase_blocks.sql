-- ownedBlocks() (lib/gymProgram.ts) was counting purchase records instead of blocks
-- actually granted, so a "3 blocks for $19" purchase only unlocked 1 block. This adds
-- the missing column; existing rows default to 1 (matches what they actually granted
-- under the old, wrong counting logic — a real fix would need to know which existing
-- rows were the $19 tier, which the label text alone doesn't reliably parse, so this
-- only prevents the bug going forward).

alter table purchases
  add column if not exists blocks int not null default 1;
