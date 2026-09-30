// The gym program's paid blocks as store products — the single place that says
// which products exist, which blocks each one unlocks, what to offer next, and
// what someone owns. Pure (no store SDK), so lib/purchases.ts, the Plans and
// Purchases screens, and restore all read the same answers.
//
// The gym program runs 6 blocks. Block 1 is free. Blocks 2–6 are each a
// non-consumable product, and one fixed bundle covers 2–4; blocks 5 and 6 are
// sold one at a time. Non-consumable means each product can be bought once per
// store account, so a bundle has to name its blocks: restore only reports "this
// account owns gym_bundle_02_04", and that has to mean the same three blocks forever.
//
// Product IDs are permanent in App Store Connect and Google Play (they can't be
// renamed or reused after deletion), which is why they carry a `gym_` prefix:
// Hyrox and Marathon blocks will need their own products once those programs have
// real content, and this keeps the namespaces apart. Only gym products exist.

export const MAX_BLOCKS = 6;
export const PRICE_ONE = 9; // shown only until the store's own localized price loads
export const PRICE_THREE = 19;

const pad = (n: number) => String(n).padStart(2, "0");

export type BlockProduct = {
  id: string; // the store product identifier
  blocks: number[]; // the specific blocks it unlocks
  price: number; // fallback display price, in USD
};

export const SINGLE_PRODUCTS: BlockProduct[] = Array.from({ length: MAX_BLOCKS - 1 }, (_, i) => {
  const b = i + 2;
  return { id: `gym_block_${pad(b)}`, blocks: [b], price: PRICE_ONE };
});

export const BUNDLE_PRODUCTS: BlockProduct[] = [2].map((first) => ({
  id: `gym_bundle_${pad(first)}_${pad(first + 2)}`,
  blocks: [first, first + 1, first + 2],
  price: PRICE_THREE,
}));

export const ALL_PRODUCTS: BlockProduct[] = [...SINGLE_PRODUCTS, ...BUNDLE_PRODUCTS];

const BY_ID: Record<string, BlockProduct> = Object.fromEntries(ALL_PRODUCTS.map((p) => [p.id, p]));

export function productFor(id: string | null | undefined): BlockProduct | null {
  return (id && BY_ID[id]) || null;
}

// Blocks 1..N, where N is the highest block reached without a gap. Purchases are
// only ever offered for the very next block, so ownership is always contiguous —
// but a restore or a second device can report the same block twice (e.g. block
// 3 bought alone on one phone, then bundle 2–4 on another before they synced),
// so this unions the blocks rather than adding up counts.
//
// Rows with no productId predate per-product purchases (the old "+1 / +3"
// records): those always granted the next blocks in order, so their counts sit
// directly after block 1. Rows for a product this catalog doesn't know (a future
// Hyrox block) are ignored here.
export function ownedBlocks(purchases: { blocks: number; productId?: string | null }[]): number {
  const granted = new Set<number>();
  let legacy = 0;
  for (const p of purchases) {
    if (!p.productId) legacy += p.blocks || 1;
    else productFor(p.productId)?.blocks.forEach((b) => granted.add(b));
  }
  let n = 1 + legacy;
  while (granted.has(n + 1)) n++;
  return Math.min(n, MAX_BLOCKS);
}

// What the Plans screen can sell someone who owns blocks 1..owned: the next
// single block, and a bundle only when one starts at exactly that block. Both
// null once every block is owned.
export function nextOffers(owned: number): { single: BlockProduct | null; bundle: BlockProduct | null } {
  const next = owned + 1;
  if (next > MAX_BLOCKS) return { single: null, bundle: null };
  return {
    single: productFor(`gym_block_${pad(next)}`),
    bundle: BUNDLE_PRODUCTS.find((b) => b.blocks[0] === next) ?? null,
  };
}

// "Block 5" / "Blocks 2–4" — the receipt label for a product.
export function productLabel(p: BlockProduct): string {
  const first = p.blocks[0];
  const last = p.blocks[p.blocks.length - 1];
  return first === last ? `Block ${first}` : `Blocks ${first}–${last}`;
}
