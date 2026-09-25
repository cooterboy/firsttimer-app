import React, { createContext, useContext, useState } from "react";

type WorkoutModalContextValue = {
  visible: boolean;
  open: () => void;
  close: () => void;
};

const WorkoutModalContext = createContext<WorkoutModalContextValue | null>(null);

export function WorkoutModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <WorkoutModalContext.Provider value={{ visible, open: () => setVisible(true), close: () => setVisible(false) }}>
      {children}
    </WorkoutModalContext.Provider>
  );
}

export function useWorkoutModal() {
  const ctx = useContext(WorkoutModalContext);
  if (!ctx) throw new Error("useWorkoutModal must be used inside a WorkoutModalProvider");
  return ctx;
}
