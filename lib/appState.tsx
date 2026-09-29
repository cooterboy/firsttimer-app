import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  deleteSession as deleteSessionRemote,
  deleteWeighIn as deleteWeighInRemote,
  CategoryInfo,
  fetchProgramContent,
  fetchRemoteState,
  fetchShopItems,
  pushConnectedAccount,
  pushFriend,
  pushMobility,
  pushProfile,
  pushProgramNotify,
  pushPurchase,
  pushSession,
  pushSettings,
  pushWalk,
  pushWeighIn,
  resetTestData as resetTestDataRemote,
  ShopItem,
} from "./sync";
import { loadCachedState, saveCachedState, type CachedState } from "./localCache";
import {
  loadCachedProgramContent,
  loadCachedShopItems,
  saveCachedProgramContent,
  saveCachedShopItems,
} from "./contentCache";
import { AWAY_DAYS, convertHistoryUnits, convertProfileWeight, devSeedNearBlockEnd, recoveryProtectedDays } from "./sessionEngine";
import { setHapticsEnabled } from "./haptics";
import { applySignupDetails } from "./signupDetails";
import { setSoundsEnabled } from "./sound";
import { GYM_PROGRAM, Program, selectProgram } from "./gymProgram";
import { ActiveWorkout, Friend, HistoryEntry, MobilityEntry, Profile, Purchase, Settings, WalkEntry, WeighIn } from "./types";

// Fallback category cards — the `categories` rows migration 013 carries over,
// for a fresh install with no cache and no network yet. Fetched rows always win.
const fallbackCategories: CategoryInfo[] = [
  { key: "gym", name: "Gym", sub: "24 sessions a block · strength", live: true },
  { key: "hyrox", name: "Hyrox", sub: "12 weeks to race day", live: false },
  { key: "marathon", name: "Marathon prep", sub: "16 weeks, one long run at a time", live: false },
];

// In-memory app state, mirroring the shape of the prototype's `state` object
// (profile, settings, block/session position, history, streak, in-progress workout),
// now backed by Supabase: local state is the source of truth for the UI, and every
// meaningful change pushes to Supabase in the background (write local first, push
// when online, last-write-wins — see CLAUDE.md's sync rule).

const defaultProfile: Profile = {
  name: "",
  units: "imperial",
  where: "gym",
  reps: "balanced",
  length: 45,
  pain: [],
  age: null,
  heightCm: null,
  weight: null,
  goal: null,
  days: 3,
  activity: null,
  why: null,
  medicalDisclaimerAccepted: false,
  friendsOptIn: false,
  boxCode: "",
  city: "",
  recoveryAdjustedAt: null,
};

const defaultSettings: Settings = {
  restDefault: 60,
  autoRest: true,
  warmup: true,
  cues: true,
  weighin: true,
  reminders: true,
  remindTime: "7:00 am",
  mobilityReminder: true,
  recapReminder: true,
  mobility: "weekly",
  accent: "orange",
  sounds: true,
  haptics: true,
  quotes: true,
  paused: false,
  openerSeen: "",
  recapSeen: "",
};

type AppState = {
  profile: Profile;
  settings: Settings;
  block: number;
  session: number; // index within the block, 0-based
  history: HistoryEntry[];
  mobility: MobilityEntry[];
  walks: WalkEntry[];
  weighins: WeighIn[];
  friends: Friend[];
  connectedAccounts: Record<string, boolean>;
  notify: Record<string, boolean>;
  purchases: Purchase[];
  program: Program; // the plan for profile.where — see selectProgram()
  categories: CategoryInfo[];
  shopItems: ShopItem[];
  streak: number;
  lastDate: string | null;
  active: ActiveWorkout | null;
  userId: string | null;
  userEmail: string | null;
  authLoading: boolean;
  syncError: boolean;
};

type AppStateContextValue = AppState & {
  setActive: (wo: ActiveWorkout | null) => void;
  commitSession: (entry: HistoryEntry) => void;
  commitBackfill: (entry: HistoryEntry) => void;
  commitMobility: (entry: MobilityEntry) => void;
  commitWalk: (entry: WalkEntry) => void;
  updateWalkEntry: (id: string, patch: Partial<WalkEntry>) => void;
  commitWeighIn: (entry: WeighIn) => void;
  updateWeighIn: (id: string, w: number) => void;
  deleteWeighIn: (id: string) => void;
  commitFriend: (entry: Friend) => void;
  toggleFriendBump: (code: string) => void;
  toggleConnectedAccount: (network: string) => void;
  toggleProgramNotify: (category: string) => void;
  commitPurchase: (entry: Purchase) => void;
  advanceBlock: () => void;
  restartBlockPosition: () => void;
  updateHistoryEntry: (block: number, idx: number, patch: Partial<HistoryEntry>) => void;
  deleteHistoryEntry: (block: number, idx: number) => void;
  signUp: (email: string, password: string, name: string, units: Profile["units"], age: number | null) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  resetTestData: () => Promise<void>;
  devSeedNearBlockEnd: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setUnits: (to: Profile["units"]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);
  useEffect(() => {
    setSoundsEnabled(settings.sounds);
  }, [settings.sounds]);
  const [block, setBlock] = useState(1);
  const [session, setSession] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mobility, setMobility] = useState<MobilityEntry[]>([]);
  const [walks, setWalks] = useState<WalkEntry[]>([]);
  const [weighins, setWeighins] = useState<WeighIn[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({});
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  // Content-as-data (migrations 013/014): the category cards and every live
  // plan — fetched from Supabase, cached locally, falling back to
  // lib/gymProgram.ts's GYM_PROGRAM only if a fresh install has neither a cache
  // nor a network connection yet. `program` (below) is the one plan in use.
  const [programs, setPrograms] = useState<Program[]>([GYM_PROGRAM]);
  const [categories, setCategories] = useState<CategoryInfo[]>(fallbackCategories);
  const program = useMemo(() => selectProgram(programs, profile.where), [programs, profile.where]);
  // Content-as-data (migration 012): gear/box-reorder items. No bundled fallback —
  // unlike the movement bank, an empty shop is an honest, expected state (no real
  // brand deals exist yet), not a broken one.
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);

  // Read fresh in async callbacks without re-subscribing effects on every change.
  const latest = useRef({ profile, block, session, streak, lastDate });
  useEffect(() => {
    latest.current = { profile, block, session, streak, lastDate };
  });

  // Guards the write-through cache effect below against a real race: setUserId
  // commits (and can render) before the async cache read resolves, and without
  // this guard that in-between render — userId set, profile still the in-memory
  // default — would overwrite a perfectly good on-disk cache with blank data.
  // Flips true once the boot sequence has decided what to show, cache hit or not.
  const bootSettled = useRef(false);

  const resetLocal = () => {
    setProfile(defaultProfile);
    setSettings(defaultSettings);
    setBlock(1);
    setSession(0);
    setHistory([]);
    setMobility([]);
    setWalks([]);
    setWeighins([]);
    setFriends([]);
    setConnectedAccounts({});
    setNotify({});
    setPurchases([]);
    setStreak(0);
    setLastDate(null);
    setActive(null);
    setSyncError(false);
  };

  // Shared by both the local-cache apply and the real network hydrate below, so a
  // cached snapshot and a fresh server one paint through the exact same path.
  // Deliberately excludes `active` — the server has no concept of an in-progress
  // workout, so a remote hydrate must never touch (or wipe) it; only the cache
  // path restores it, explicitly, below.
  const applyState = (s: Omit<CachedState, "active">) => {
    setProfile(s.profile);
    setSettings({ ...defaultSettings, ...(s.settings || {}) });
    setBlock(s.block);
    setSession(s.session);
    setStreak(s.streak);
    setLastDate(s.lastDate);
    setHistory(s.history);
    setMobility(s.mobility);
    setWalks(s.walks);
    setWeighins(s.weighins);
    setFriends(s.friends);
    setConnectedAccounts(s.connectedAccounts);
    setNotify(s.notify);
    setPurchases(s.purchases);
  };

  // The actual network fetch + reconcile. Never awaited by the boot sequence — it
  // runs quietly in the background after cached (or blank) state is already on
  // screen, and just updates state again once it resolves.
  const refreshRemote = async (uid: string) => {
    try {
      const remote = await fetchRemoteState(uid);
      if (remote) {
        let profileToUse = remote.profile;
        // Sign-up details normally land in the profile row via the database
        // trigger (migration 017). Until 017 has run, the row starts blank — so
        // fill it from what signUp stored on the account itself. That copy lives
        // in Supabase, so unlike an in-memory hold it survives email confirmation
        // and app restarts, and this simply retries on every load until it lands.
        const { data } = await supabase.auth.getSession();
        const withSignup = applySignupDetails(remote.profile, data.session?.user.user_metadata);
        if (withSignup !== remote.profile) {
          profileToUse = withSignup;
          pushProfile(uid, profileToUse, {
            block: remote.block,
            session: remote.session,
            streak: remote.streak,
            lastDate: remote.lastDate,
          }).catch((e) => console.warn("Profile save failed, staying local:", e));
        }
        applyState({ ...remote, profile: profileToUse });
      }
      setSyncError(false);
    } catch (e) {
      // Distinct from "new account" — this is "couldn't reach your real data,"
      // so the UI can say so instead of quietly looking like a wipe. Whatever the
      // cache (or prior in-memory state) already showed stays on screen as-is.
      setSyncError(true);
      console.warn("Could not load your saved data — staying on what's local.", e);
    }
  };

  // Content-as-data: cache-first, then a background network refresh — same
  // shape as the per-user hydrate above, but this is shared, account-independent
  // content, so it only needs a signed-in session to read (RLS: authenticated),
  // not a specific uid.
  const loadProgramContent = async () => {
    const cached = await loadCachedProgramContent();
    if (cached) {
      setPrograms(cached.programs);
      setCategories(cached.categories);
    }
    try {
      const fresh = await fetchProgramContent();
      if (fresh) {
        setPrograms(fresh.programs);
        setCategories(fresh.categories);
        saveCachedProgramContent(fresh).catch(() => {});
      }
    } catch (e) {
      console.warn("Program content refresh failed, staying on cache/fallback:", e);
    }
  };

  useEffect(() => {
    if (userId) loadProgramContent();
  }, [userId]);

  // Same cache-first-then-refresh shape as loadProgramContent above, for shop_items
  // (migration 012).
  const loadShopItems = async () => {
    const cached = await loadCachedShopItems();
    if (cached) setShopItems(cached);
    try {
      const fresh = await fetchShopItems();
      if (fresh) {
        setShopItems(fresh);
        saveCachedShopItems(fresh).catch(() => {});
      }
    } catch (e) {
      console.warn("Shop items refresh failed, staying on cache:", e);
    }
  };

  useEffect(() => {
    if (userId) loadShopItems();
  }, [userId]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      bootSettled.current = true;
      return;
    }
    let cancelled = false;
    let bootUid: string | null = null;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        bootUid = data.session?.user.id || null;
        setUserId(bootUid);
        setUserEmail(data.session?.user.email || null);
        // Cache-first: apply whatever was last saved to disk for this account
        // before the splash screen even hides, so a cold boot never shows a
        // blank/default screen while the network fetch is still in flight.
        if (bootUid) {
          const cached = await loadCachedState(bootUid);
          if (cached && !cancelled) {
            applyState(cached);
            setActive(cached.active);
          }
        }
      } catch (e) {
        // Falls back to the sign-in screen rather than hanging on the splash forever.
        console.warn("Could not check for an existing session — showing sign-in:", e);
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
          bootSettled.current = true;
        }
      }
      if (bootUid && !cancelled) refreshRemote(bootUid);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession: Session | null) => {
      const uid = newSession?.user.id || null;
      setUserId(uid);
      setUserEmail(newSession?.user.email || null);
      if (event === "SIGNED_OUT") resetLocal();
      if (event === "SIGNED_IN" && uid) refreshRemote(uid);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; refreshRemote isn't memoized and re-subscribing onAuthStateChange every render would be the real bug
  }, []);

  // Write-through: whatever's in memory for the signed-in account is mirrored to
  // disk after every change, so the next cold boot's cache-first read is never
  // more than one render behind. Skipped while signed out so a sign-out's reset
  // to blank defaults can't clobber the real cached snapshot for that account.
  useEffect(() => {
    if (!userId || !bootSettled.current) return;
    saveCachedState(userId, {
      profile,
      settings,
      block,
      session,
      streak,
      lastDate,
      history,
      mobility,
      walks,
      weighins,
      friends,
      connectedAccounts,
      notify,
      purchases,
      active,
    }).catch(() => {});
  }, [userId, profile, settings, block, session, streak, lastDate, history, mobility, walks, weighins, friends, connectedAccounts, notify, purchases, active]);

  // prototype's logSession(): push the entry once, bump streak/session/block position.
  const commitSession = (entry: HistoryEntry) => {
    setHistory((h) => {
      if (h.some((x) => x.block === entry.block && x.idx === entry.idx)) return h;
      const rawGap = lastDate ? (Date.now() - new Date(lastDate).getTime()) / 86400000 : 0;
      const gap = rawGap - recoveryProtectedDays(lastDate, profile.recoveryAdjustedAt);
      const newStreak = gap > AWAY_DAYS && !settings.paused ? 1 : streak + 1;
      setStreak(newStreak);
      setLastDate(entry.date);
      setSession((s) => s + 1);
      if (settings.paused) updateSettings({ paused: false });
      if (userId) {
        pushSession(userId, entry).catch((e) => console.warn("Session save failed, staying local:", e));
        pushProfile(userId, latest.current.profile, {
          block: latest.current.block,
          session: latest.current.session + 1,
          streak: newStreak,
          lastDate: entry.date,
        }).catch((e) => console.warn("Profile save failed, staying local:", e));
      }
      return [...h, entry];
    });
  };

  // prototype's SUB.backfill submit handler: same session-position bump as a real
  // session, but streak is a flat +1 (no gap check — you're telling it you trained,
  // full stop) and lastDate only moves forward if the backfilled date is newer.
  const commitBackfill = (entry: HistoryEntry) => {
    setHistory((h) => {
      if (h.some((x) => x.block === entry.block && x.idx === entry.idx)) return h;
      const newStreak = streak + 1;
      const newLastDate = !lastDate || new Date(entry.date) > new Date(lastDate) ? entry.date : lastDate;
      setStreak(newStreak);
      setLastDate(newLastDate);
      setSession((s) => s + 1);
      if (userId) {
        pushSession(userId, entry).catch((e) => console.warn("Backfill save failed, staying local:", e));
        pushProfile(userId, latest.current.profile, {
          block: latest.current.block,
          session: latest.current.session + 1,
          streak: newStreak,
          lastDate: newLastDate,
        }).catch((e) => console.warn("Profile save failed, staying local:", e));
      }
      return [...h, entry].sort((a, b) => a.block - b.block || a.idx - b.idx);
    });
  };

  // Mobility days and walks/runs are logged separately from sessions on purpose —
  // the streak, milestones and month-two number all measure lifting, and neither of
  // these should ever be able to keep a lifting streak alive.
  const commitMobility = (entry: MobilityEntry) => {
    setMobility((m) => [...m, entry]);
    if (userId) pushMobility(userId, entry).catch((e) => console.warn("Mobility save failed, staying local:", e));
  };

  const commitWalk = (entry: WalkEntry) => {
    setWalks((w) => [...w, entry]);
    if (userId) pushWalk(userId, entry).catch((e) => console.warn("Walk save failed, staying local:", e));
  };

  // Tapping "how did that feel" / "anything hurt" on the finish screen updates the
  // same walk entry already committed above, then re-pushes it.
  const updateWalkEntry = (id: string, patch: Partial<WalkEntry>) => {
    setWalks((w) =>
      w.map((x) => {
        if (x.id !== id) return x;
        const next = { ...x, ...patch };
        if (userId) pushWalk(userId, next).catch((e) => console.warn("Walk update failed, staying local:", e));
        return next;
      })
    );
  };

  // prototype's weigh-in log handlers: pushes the entry, and — same as the
  // prototype — keeps profile.weight in sync with the latest one, since the
  // nutrition card's calorie estimate reads from profile.weight, not the log.
  const commitWeighIn = (entry: WeighIn) => {
    setWeighins((w) => [...w, entry]);
    updateProfile({ weight: entry.w });
    if (userId) pushWeighIn(userId, entry).catch((e) => console.warn("Weigh-in save failed, staying local:", e));
  };

  const latestWeighInValue = (ws: WeighIn[]): number | null => {
    const latest = [...ws].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return latest ? latest.w : null;
  };

  // Correcting or removing a mislogged weigh-in — same rationale as the recent
  // SessionDetailSheet weight-edit fix: an append-only log still needs a way to fix a
  // mistake. Keeps profile.weight (read by the nutrition card's calorie estimate) in
  // sync with whatever's now actually the latest entry, same invariant commitWeighIn
  // already maintains for a fresh log.
  const updateWeighIn = (id: string, w: number) => {
    const next = weighins.map((x) => (x.id === id ? { ...x, w } : x));
    setWeighins(next);
    const entry = next.find((x) => x.id === id);
    if (entry && userId) pushWeighIn(userId, entry).catch((e) => console.warn("Weigh-in update failed, staying local:", e));
    const latest = latestWeighInValue(next);
    if (latest != null) updateProfile({ weight: latest });
  };

  const deleteWeighIn = (id: string) => {
    const next = weighins.filter((x) => x.id !== id);
    setWeighins(next);
    if (userId) deleteWeighInRemote(userId, id).catch((e) => console.warn("Weigh-in delete failed, staying local:", e));
    const latest = latestWeighInValue(next);
    if (latest != null) updateProfile({ weight: latest });
  };

  const commitFriend = (entry: Friend) => {
    setFriends((f) => [...f, entry]);
    if (userId) pushFriend(userId, entry).catch((e) => console.warn("Friend save failed, staying local:", e));
  };

  const toggleFriendBump = (code: string) => {
    setFriends((list) => {
      const next = list.map((f) => (f.code === code ? { ...f, bumped: !f.bumped } : f));
      const updated = next.find((f) => f.code === code);
      if (userId && updated) pushFriend(userId, updated).catch((e) => console.warn("Friend bump save failed, staying local:", e));
      return next;
    });
  };

  const toggleConnectedAccount = (network: string) => {
    setConnectedAccounts((cur) => {
      const next = { ...cur, [network]: !cur[network] };
      if (userId) pushConnectedAccount(userId, network, next[network]).catch((e) => console.warn("Connected-account save failed, staying local:", e));
      return next;
    });
  };

  const toggleProgramNotify = (category: string) => {
    setNotify((cur) => {
      const next = { ...cur, [category]: !cur[category] };
      if (userId) pushProgramNotify(userId, category, next[category]).catch((e) => console.warn("Program-notify save failed, staying local:", e));
      return next;
    });
  };

  // Replaces a record with the same id rather than appending — ids are one per
  // (account, product), so this mirrors the upsert pushPurchase does in Supabase.
  const commitPurchase = (entry: Purchase) => {
    setPurchases((p) => [...p.filter((x) => x.id !== entry.id), entry]);
    if (userId) pushPurchase(userId, entry).catch((e) => console.warn("Purchase save failed, staying local:", e));
  };

  const advanceBlock = () => {
    const newBlock = block + 1;
    setBlock(newBlock);
    setSession(0);
    if (userId) {
      pushProfile(userId, latest.current.profile, {
        block: newBlock,
        session: 0,
        streak: latest.current.streak,
        lastDate: latest.current.lastDate,
      }).catch((e) => console.warn("Block-advance save failed, staying local:", e));
    }
  };

  // Comeback card's "start the block over": same block, back to session 1. History
  // stays exactly as-is — nothing here touches it, only the position pointer.
  const restartBlockPosition = () => {
    setSession(0);
    if (userId) {
      pushProfile(userId, latest.current.profile, {
        block: latest.current.block,
        session: 0,
        streak: latest.current.streak,
        lastDate: latest.current.lastDate,
      }).catch((e) => console.warn("Restart save failed, staying local:", e));
    }
  };

  const updateProfile = (patch: Partial<Profile>) => {
    setProfile((p) => {
      const next = { ...p, ...patch };
      if (userId) {
        pushProfile(userId, next, {
          block: latest.current.block,
          session: latest.current.session,
          streak: latest.current.streak,
          lastDate: latest.current.lastDate,
        }).catch((e) => console.warn("Profile save failed, staying local:", e));
      }
      return next;
    });
  };

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (userId) pushSettings(userId, next).catch((e) => console.warn("Settings save failed, staying local:", e));
      return next;
    });
  };

  // prototype's convertUnits(): switching lb/kg converts every stored weight in place,
  // so a number typed under one unit doesn't silently mean something else under the other.
  const setUnits = async (to: Profile["units"]) => {
    if (to === profile.units) return;
    const convertedHistory = convertHistoryUnits(history, to);
    const convertedWeight = convertProfileWeight(profile.weight, to);
    const nextProfile = { ...profile, units: to, weight: convertedWeight };
    setHistory(convertedHistory);
    setProfile(nextProfile);
    if (userId) {
      try {
        await Promise.all(convertedHistory.map((e) => pushSession(userId, e)));
        await pushProfile(userId, nextProfile, {
          block: latest.current.block,
          session: latest.current.session,
          streak: latest.current.streak,
          lastDate: latest.current.lastDate,
        });
      } catch (e) {
        console.warn("Unit conversion save failed, staying local:", e);
      }
    }
  };

  const updateHistoryEntry = (blockN: number, idx: number, patch: Partial<HistoryEntry>) => {
    setHistory((h) =>
      h.map((e) => {
        if (e.block !== blockN || e.idx !== idx) return e;
        const next = { ...e, ...patch };
        if (userId) pushSession(userId, next).catch((err) => console.warn("Update save failed, staying local:", err));
        return next;
      })
    );
  };

  // prototype's sdDelYes handler: remove it, and if it was the most recently logged
  // session, rewind the block position back one so the next session prefills from
  // whatever's now actually last, matching exactly (a flat -1 on streak, no smarter
  // recompute — same simplification the prototype makes).
  const deleteHistoryEntry = (blockN: number, idx: number) => {
    const target = history.find((e) => e.block === blockN && e.idx === idx);
    if (!target) return;
    setHistory((h) => h.filter((e) => !(e.block === blockN && e.idx === idx)));
    const rewindSession = blockN === latest.current.block && idx === latest.current.session - 1;
    const newSession = rewindSession ? Math.max(0, latest.current.session - 1) : latest.current.session;
    const newStreak = Math.max(0, latest.current.streak - 1);
    setStreak(newStreak);
    if (rewindSession) setSession(newSession);
    if (userId) {
      deleteSessionRemote(userId, target.id).catch((e) => console.warn("Session delete failed, staying local:", e));
      pushProfile(userId, latest.current.profile, {
        block: latest.current.block,
        session: newSession,
        streak: newStreak,
        lastDate: latest.current.lastDate,
      }).catch((e) => console.warn("Profile save failed, staying local:", e));
    }
  };

  const signUp = async (email: string, password: string, name: string, units: Profile["units"], age: number | null) => {
    // name/units/age travel with the sign-up itself (stored on the account as user
    // metadata), and the database trigger copies them into the new profile row —
    // nothing is held in app memory waiting for a first sign-in (migration 017).
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, units, age } } });
    if (error) return { error: error.message, needsEmailConfirm: false };
    return { error: null, needsEmailConfirm: !data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ? error.message : null };
  };

  // Prototype's change-password check verifies the current password by comparing
  // a local hash (spec/prototype.html:3210). Supabase has no such API, so the
  // real equivalent is to re-authenticate with the current password first — same
  // effect (a wrong current password fails distinctly from a weak new one)
  // without exposing anything an unlocked session shouldn't.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!userEmail) return { error: "Not signed in." };
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (reauthError) return { error: "Current password isn't right." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  };

  const resetTestData = async () => {
    if (userId) {
      try {
        await resetTestDataRemote(userId);
      } catch (e) {
        console.warn("Remote reset failed, resetting local state anyway:", e);
      }
    }
    setHistory([]);
    setMobility([]);
    setWalks([]);
    setWeighins([]);
    setBlock(1);
    setSession(0);
    setStreak(0);
    setLastDate(null);
    setActive(null);
  };

  // Dev-only: fabricate 23 sessions so the next real playthrough is session 24 —
  // lets you reach block-end/retest screens without grinding through the whole block.
  const devSeedNearBlockEndFn = () => {
    const seeded = devSeedNearBlockEnd(program, block);
    setHistory(seeded);
    setSession(seeded.length);
    setStreak(seeded.length);
    setLastDate(seeded[seeded.length - 1].date);
    setActive(null);
  };

  const value = useMemo<AppStateContextValue>(
    () => ({
      profile,
      settings,
      block,
      session,
      history,
      mobility,
      walks,
      weighins,
      friends,
      connectedAccounts,
      notify,
      purchases,
      program,
      categories,
      shopItems,
      streak,
      lastDate,
      active,
      userId,
      userEmail,
      authLoading,
      syncError,
      setActive,
      commitSession,
      commitBackfill,
      commitMobility,
      commitWalk,
      updateWalkEntry,
      commitWeighIn,
      updateWeighIn,
      deleteWeighIn,
      commitFriend,
      toggleFriendBump,
      toggleConnectedAccount,
      toggleProgramNotify,
      commitPurchase,
      advanceBlock,
      restartBlockPosition,
      updateHistoryEntry,
      deleteHistoryEntry,
      signUp,
      signIn,
      signOut,
      resetPassword,
      changePassword,
      resetTestData,
      devSeedNearBlockEnd: devSeedNearBlockEndFn,
      updateProfile,
      setUnits,
      updateSettings,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately state-only; none of the functions above are memoized, so listing them would make this recompute (and re-render every consumer) on every render, defeating the memo. Nothing downstream relies on their referential identity.
    [
      profile,
      settings,
      block,
      session,
      history,
      mobility,
      walks,
      weighins,
      friends,
      connectedAccounts,
      notify,
      purchases,
      program,
      categories,
      shopItems,
      streak,
      lastDate,
      active,
      userId,
      userEmail,
      authLoading,
      syncError,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside an AppStateProvider");
  return ctx;
}
