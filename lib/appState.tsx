import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  deleteSession as deleteSessionRemote,
  fetchRemoteState,
  pushMobility,
  pushProfile,
  pushSession,
  pushSettings,
  pushWalk,
  resetTestData as resetTestDataRemote,
} from "./sync";
import { loadCachedState, saveCachedState, type CachedState } from "./localCache";
import { convertHistoryUnits, convertProfileWeight, devSeedNearBlockEnd } from "./sessionEngine";
import { ActiveWorkout, HistoryEntry, MobilityEntry, Profile, Settings, WalkEntry } from "./types";

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
};

const defaultSettings: Settings = {
  restDefault: 60,
  autoRest: true,
  warmup: true,
  cues: true,
  weighin: true,
  reminders: true,
  remindTime: "7:00 am",
  mobility: "weekly",
};

type AppState = {
  profile: Profile;
  settings: Settings;
  block: number;
  session: number; // index within the block, 0-based
  history: HistoryEntry[];
  mobility: MobilityEntry[];
  walks: WalkEntry[];
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
  advanceBlock: () => void;
  restartBlockPosition: () => void;
  updateHistoryEntry: (block: number, idx: number, patch: Partial<HistoryEntry>) => void;
  deleteHistoryEntry: (block: number, idx: number) => void;
  signUp: (email: string, password: string, name: string, units: Profile["units"]) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
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
  const [block, setBlock] = useState(1);
  const [session, setSession] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mobility, setMobility] = useState<MobilityEntry[]>([]);
  const [walks, setWalks] = useState<WalkEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);

  // Read fresh in async callbacks without re-subscribing effects on every change.
  const latest = useRef({ profile, block, session, streak, lastDate });
  latest.current = { profile, block, session, streak, lastDate };

  // The name/units typed at sign-up, held here when email confirmation is required
  // (signUp returns no session in that case, so there's nothing to push to yet).
  // Applied the moment a real, confirmed session shows up.
  const pendingSignup = useRef<{ name: string; units: Profile["units"] } | null>(null);

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
  };

  // The actual network fetch + reconcile. Never awaited by the boot sequence — it
  // runs quietly in the background after cached (or blank) state is already on
  // screen, and just updates state again once it resolves.
  const refreshRemote = async (uid: string) => {
    try {
      const remote = await fetchRemoteState(uid);
      if (remote) {
        let profileToUse = remote.profile;
        // The name/units they typed at sign-up never made it to the server if
        // email confirmation was required — apply it now that we have a real session.
        if (!remote.profile.name && pendingSignup.current) {
          profileToUse = { ...remote.profile, name: pendingSignup.current.name, units: pendingSignup.current.units };
          pendingSignup.current = null;
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
  }, []);

  // Write-through: whatever's in memory for the signed-in account is mirrored to
  // disk after every change, so the next cold boot's cache-first read is never
  // more than one render behind. Skipped while signed out so a sign-out's reset
  // to blank defaults can't clobber the real cached snapshot for that account.
  useEffect(() => {
    if (!userId || !bootSettled.current) return;
    saveCachedState(userId, { profile, settings, block, session, streak, lastDate, history, mobility, walks, active }).catch(() => {});
  }, [userId, profile, settings, block, session, streak, lastDate, history, mobility, walks, active]);

  // prototype's logSession(): push the entry once, bump streak/session/block position.
  const commitSession = (entry: HistoryEntry) => {
    setHistory((h) => {
      if (h.some((x) => x.block === entry.block && x.idx === entry.idx)) return h;
      const gap = lastDate ? (Date.now() - new Date(lastDate).getTime()) / 86400000 : 0;
      const newStreak = gap > 10 ? 1 : streak + 1;
      setStreak(newStreak);
      setLastDate(entry.date);
      setSession((s) => s + 1);
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

  const signUp = async (email: string, password: string, name: string, units: Profile["units"]) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsEmailConfirm: false };
    // Hold the name/units here; onAuthStateChange -> hydrateFrom applies and pushes
    // them the moment a real session exists (immediately if email confirmation is
    // off, or after they confirm and sign in for real if it's on).
    pendingSignup.current = { name, units };
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
    setBlock(1);
    setSession(0);
    setStreak(0);
    setLastDate(null);
    setActive(null);
  };

  // Dev-only: fabricate 23 sessions so the next real playthrough is session 24 —
  // lets you reach block-end/retest screens without grinding through the whole block.
  const devSeedNearBlockEndFn = () => {
    const seeded = devSeedNearBlockEnd(block);
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
      advanceBlock,
      restartBlockPosition,
      updateHistoryEntry,
      deleteHistoryEntry,
      signUp,
      signIn,
      signOut,
      resetPassword,
      resetTestData,
      devSeedNearBlockEnd: devSeedNearBlockEndFn,
      updateProfile,
      setUnits,
      updateSettings,
    }),
    [
      profile,
      settings,
      block,
      session,
      history,
      mobility,
      walks,
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
