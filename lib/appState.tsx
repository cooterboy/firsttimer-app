import React, { createContext, useContext, useMemo, useState } from "react";
import { ActiveWorkout, HistoryEntry, Profile, Settings } from "./types";

// In-memory app state, mirroring the shape of the prototype's `state` object
// (profile, settings, block/session position, history, streak, in-progress workout).
// This does not persist across app restarts yet — that arrives with Supabase in
// build step 3. For now it's enough to run the full session flow end to end.

const defaultProfile: Profile = {
  name: "",
  units: "imperial",
  where: "gym",
  reps: "balanced",
  length: 45,
  pain: [],
};

const defaultSettings: Settings = {
  restDefault: 60,
  autoRest: true,
  warmup: true,
  cues: true,
  weighin: true,
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
};

type AppStateContextValue = AppState & {
  setActive: (wo: ActiveWorkout | null) => void;
  commitSession: (entry: HistoryEntry) => void;
  advanceBlock: () => void;
  updateHistoryEntry: (block: number, idx: number, patch: Partial<HistoryEntry>) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [profile] = useState<Profile>(defaultProfile);
  const [settings] = useState<Settings>(defaultSettings);
  const [block, setBlock] = useState(1);
  const [session, setSession] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveWorkout | null>(null);

  // prototype's logSession(): push the entry once, bump streak/session/block position.
  const commitSession = (entry: HistoryEntry) => {
    setHistory((h) => {
      if (h.some((x) => x.block === entry.block && x.idx === entry.idx)) return h;
      const gap = lastDate ? (Date.now() - new Date(lastDate).getTime()) / 86400000 : 0;
      setStreak((s) => (gap > 10 ? 1 : s + 1));
      setLastDate(entry.date);
      setSession((s) => s + 1);
      return [...h, entry];
    });
  };

  const advanceBlock = () => {
    setBlock((b) => b + 1);
    setSession(0);
  };

  const updateHistoryEntry = (block: number, idx: number, patch: Partial<HistoryEntry>) => {
    setHistory((h) => h.map((e) => (e.block === block && e.idx === idx ? { ...e, ...patch } : e)));
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
      setActive,
      commitSession,
      advanceBlock,
      updateHistoryEntry,
    }),
    [profile, settings, block, session, history, streak, lastDate, active]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside an AppStateProvider");
  return ctx;
}
