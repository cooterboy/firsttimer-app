// Ported from spec/prototype.html's NETWORKS constant. GEAR/SLOTS used to live here
// too, hardcoded — they're now content-as-data (migration 012's shop_items table,
// fetched via lib/sync.ts's fetchShopItems() and read from appState.shopItems), same
// move gymProgram.ts's GYM constant made for movements in migration 009.

export const NETWORKS: { k: string; n: string }[] = [
  { k: "instagram", n: "Instagram" },
  { k: "tiktok", n: "TikTok" },
  { k: "x", n: "X" },
  { k: "strava", n: "Strava" },
];

// Ports parseBox() (spec/prototype.html:958) — format validation only. There's no
// real box/brand-partner backend, so a "valid-looking" code never actually unlocks
// anything; see ShopScreen.
export function parseBoxCode(v: string): { code: string } | null {
  const m = v.trim().toUpperCase().match(/^FT-([A-Z]{2,5})-(\d{1,2})-(\d{3,5})$/);
  if (!m) return null;
  return { code: m[0] };
}
