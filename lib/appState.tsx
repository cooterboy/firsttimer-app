import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { fetchRemoteState, pushProfile, pushSession, pushSettings, resetTestData as resetTestDataRemote } from "./sync";
import { convertHistoryUnits, convertProfileWeight, devSeedNearBlockEnd } from "./sessionEngine";
import { ActiveWorkout, HistoryEntry, Profile, Settings } from "./types";

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
};

type AppState = {
  profile: Profile;
  settings: Settings;
  block: number;
  session: number; // index within the block, 0-based
  history: HistoryEntry[];
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
  advanceBlock: () => void;
  updateHistoryEntry: (block: number, idx: number, patch: Partial<HistoryEntry>) => void;
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

  const resetLocal = () => {
    setProfile(defaultProfile);
    setSettings(defaultSettings);
    setBlock(1);
    setSession(0);
    setHistory([]);
    setStreak(0);
    setLastDate(null);
    setActive(null);
    setSyncError(false);
  };

  const hydrateFrom = async (uid: string) => {
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
        setProfile(profileToUse);
        setSettings({ ...defaultSettings, ...(remote.settings || {}) });
        setBlock(remote.block);
        setSession(remote.session);
        setStreak(remote.streak);
        setLastDate(remote.lastDate);
        setHistory(remote.history);
      }
      setSyncError(false);
    } catch (e) {
      // Distinct from "new account" — this is "couldn't reach your real data,"
      // so the UI can say so instead of quietly looking like a wipe.
      setSyncError(true);
      console.warn("Could not load your saved data — staying on what's local.", e);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        const uid = data.session?.user.id || null;
        setUserId(uid);
        setUserEmail(data.session?.user.email || null);
        if (uid) await hydrateFrom(uid);
      })
      .catch((e) => {
        // Falls back to the sign-in screen rather than hanging on the splash forever.
        console.warn("Could not check for an existing session — showing sign-in:", e);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession: Session | null) => {
      const uid = newSession?.user.id || null;
      setUserId(uid);
      setUserEmail(newSession?.user.email || null);
      if (event === "SIGNED_OUT") resetLocal();
      if (event === "SIGNED_IN" && uid) hydrateFrom(uid);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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
      streak,
      lastDate,
      active,
      userId,
      userEmail,
      authLoading,
      syncError,
      setActive,
      commitSession,
      advanceBlock,
      updateHistoryEntry,
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
    [profile, settings, block, session, history, streak, lastDate, active, userId, userEmail, authLoading, syncError]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside an AppStateProvider");
  return ctx;
}
