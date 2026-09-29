import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { colorsFor, ThemeColors } from "./theme";
import { categoryTheme, CategoryKey, CategoryTheme } from "./categoryThemes";
import { useAppState } from "./appState";

// Mirrors the prototype's data-theme attribute: "system" follows the OS,
// "light" and "dark" force a scheme regardless of the OS setting.
export type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  scheme: "light" | "dark";
  colors: ThemeColors;
  category: CategoryTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Pinned to "gym" until a real "active category" exists to read live — nobody can
// actually enroll in a second category yet (see CLAUDE.md's v1 scope and
// ProgramsScreen.tsx's own note on why there's no program switcher). This constant is
// the one seam: once a real switcher ships (e.g. an appState.currentCategory), swap
// this line for that live value and every screen re-themes automatically, since they
// all already read colors and category through useTheme() — no other file needs to
// change.
const ACTIVE_CATEGORY: CategoryKey = "gym";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");
  const { settings } = useAppState();

  const scheme = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const category = useMemo(() => categoryTheme(ACTIVE_CATEGORY), []);
  const colors = useMemo(
    () => colorsFor(scheme, settings.accent, category.colors[scheme]),
    [scheme, settings.accent, category]
  );

  const value = useMemo(() => ({ mode, setMode, scheme, colors, category }), [mode, scheme, colors, category]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
