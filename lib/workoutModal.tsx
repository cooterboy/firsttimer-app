import React, { createContext, useContext, useState } from "react";

export type SessionModalKind = "workout" | "mobility" | "walk" | null;

type WorkoutModalContextValue = {
  kind: SessionModalKind;
  // A comeback session (10+ days away) eases prefilled weights down one time —
  // set here by Today's comeback card right before opening, read once by
  // WorkoutScreen when it builds a fresh workout, then cleared.
  pendingComebackFactor: number | null;
  open: (comebackFactor?: number) => void; // strength session — kept for existing call sites
  openMobility: () => void;
  openWalk: () => void;
  close: () => void;
  clearPendingComeback: () => void;
  // Sets the factor without opening the modal — used by "start the block over,"
  // which resets your position and returns to Today rather than jumping straight
  // into a session; whatever you tap Start on next picks this up.
  setPendingComeback: (factor: number) => void;
};

const WorkoutModalContext = createContext<WorkoutModalContextValue | null>(null);

export function WorkoutModalProvider({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<SessionModalKind>(null);
  const [pendingComebackFactor, setPendingComebackFactor] = useState<number | null>(null);
  return (
    <WorkoutModalContext.Provider
      value={{
        kind,
        pendingComebackFactor,
        open: (comebackFactor) => {
          // Leaves an already-set pending factor alone when called with no argument
          // (e.g. the normal Start button after "restart the block" already set one).
          if (comebackFactor !== undefined) setPendingComebackFactor(comebackFactor);
          setKind("workout");
        },
        openMobility: () => setKind("mobility"),
        openWalk: () => setKind("walk"),
        close: () => setKind(null),
        clearPendingComeback: () => setPendingComebackFactor(null),
        setPendingComeback: (factor) => setPendingComebackFactor(factor),
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
