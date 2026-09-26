// A cache-first cold boot: without this, opening the app after being force-quit
// means a blank/default screen until the Supabase fetch resolves. This mirrors
// whatever hydrateFrom last applied to AsyncStorage so it can be re-applied
// immediately on boot, then quietly refreshed from the server in the background.
// Best-effort only — a cache miss or read/write failure just falls back to the
// existing "wait for the network" behavior, so this can never make things worse.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActiveWorkout, HistoryEntry, MobilityEntry, Profile, Settings, WalkEntry } from "./types";

const CACHE_VERSION = 1;

export type CachedState = {
  profile: Profile;
  settings: Partial<Settings> | null;
  block: number;
  session: number;
  streak: number;
  lastDate: string | null;
  history: HistoryEntry[];
  mobility: MobilityEntry[];
  walks: WalkEntry[];
  // The in-progress workout, if any — cached too, so a force-quit mid-session
  // doesn't throw away sets already logged (never synced to Supabase; that's
  // fine, this is purely "restore this device to how it looked before it died").
  active: ActiveWorkout | null;
};

const keyFor = (uid: string) => `@firsttimer/cache/${uid}`;

export async function loadCachedState(uid: string): Promise<CachedState | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== CACHE_VERSION || !parsed.state) return null;
    return parsed.state as CachedState;
  } catch (e) {
    console.warn("Local cache read failed, falling back to network:", e);
    return null;
  }
}

export async function saveCachedState(uid: string, state: CachedState): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify({ v: CACHE_VERSION, state }));
  } catch (e) {
    console.warn("Local cache write failed (non-fatal):", e);
  }
}

export async function clearCachedState(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(uid));
  } catch (e) {
    console.warn("Local cache clear failed (non-fatal):", e);
  }
}
