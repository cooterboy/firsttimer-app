import React, { createContext, useContext, useState } from "react";

export type SessionModalKind = "workout" | "mobility" | "walk" | null;

type WorkoutModalContextValue = {
  kind: SessionModalKind;
  open: () => void; // strength session — kept for existing call sites
  openMobility: () => void;
  openWalk: () => void;
  close: () => void;
};

const WorkoutModalContext = createContext<WorkoutModalContextValue | null>(null);

export function WorkoutModalProvider({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<SessionModalKind>(null);
  return (
    <WorkoutModalContext.Provider
      value={{
        kind,
        open: () => setKind("workout"),
        openMobility: () => setKind("mobility"),
        openWalk: () => setKind("walk"),
        close: () => setKind(null),
      }}
    >
      {children}
    </WorkoutModalContext.Provider>
  );
}

export function useWorkoutModal() {
  const ctx = useContext(WorkoutModalContext);
  if (!ctx) throw new Error("useWorkoutModal must be used inside a WorkoutModalProvider");
  return ctx;
}
