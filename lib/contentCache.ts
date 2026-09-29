// Caches the fetched program/movement content (lib/sync.ts's fetchProgramContent)
// so a cold boot without a network connection still has a movement bank to build
// a session from. Unlike lib/localCache.ts's per-user cache, this is account-
// independent — every signed-in user reads the same shared content — so there's
// one global key, not one per uid.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProgramContent, ShopItem } from "./sync";

const CACHE_KEY = "@firsttimer/programContentCache";
const SHOP_CACHE_KEY = "@firsttimer/shopItemsCache";

export async function loadCachedProgramContent(): Promise<ProgramContent | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProgramContent;
  } catch (e) {
    console.warn("Program content cache read failed:", e);
    return null;
  }
}

export async function saveCachedProgramContent(content: ProgramContent): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(content));
  } catch (e) {
    console.warn("Program content cache write failed (non-fatal):", e);
  }
}

// Same account-independent, shared-content pattern as above, for lib/sync.ts's
// fetchShopItems() (migration 012).
export async function loadCachedShopItems(): Promise<ShopItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(SHOP_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShopItem[];
  } catch (e) {
    console.warn("Shop items cache read failed:", e);
    return null;
  }
}

export async function saveCachedShopItems(items: ShopItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SHOP_CACHE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Shop items cache write failed (non-fatal):", e);
  }
}
