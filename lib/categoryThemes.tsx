import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { ThemeColors } from "./theme";

// The category a program belongs to — mirrors ProgramInfo["category"] (lib/sync.ts)
// and the `programs` table (migration 009). Only "gym" has real session-building
// content (lib/gymProgram.ts's own header comment); hyrox/marathon are scaffolding
// until CLAUDE.md's "Reopened" programs actually ship real content. Adding a fourth
// category later means adding a key here (and a programs-table row) — not touching
// any screen that reads through useTheme().
export type CategoryKey = "gym" | "hyrox" | "marathon";

export type CategoryTheme = {
  key: CategoryKey;
  name: string;
  // Partial<ThemeColors> overrides, same shape/mechanism as theme.ts's accentOverrides
  // — merged in ThemeContext.tsx UNDER the user's personal accent choice, so switching
  // category changes the default identity without taking away accent personalization.
  colors: { light: Partial<ThemeColors>; dark: Partial<ThemeColors> };
  Icon: (props: { color: string; size?: number }) => React.JSX.Element;
};

function GymIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M4 12h2M18 12h2M6 8v8M18 8v8M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Placeholders — no real Hyrox/Marathon content exists yet (see CLAUDE.md's v1
// scope), so these just give the scaffolding a distinct, recognizable identity to
// carry through the theme layer. Swap for real marks whenever that content ships;
// nothing that reads CATEGORY_THEMES needs to change to pick up a new icon.
function HyroxIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function MarathonIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
    </Svg>
  );
}

export const CATEGORY_THEMES: Record<CategoryKey, CategoryTheme> = {
  // Empty overrides on purpose — "gym" IS the app's existing, un-themed baseline
  // (lib/theme.ts's lightColors/darkColors). Keeping it a no-op is what preserves
  // gym's current look exactly, as asked.
  gym: {
    key: "gym",
    name: "Gym",
    colors: { light: {}, dark: {} },
    Icon: GymIcon,
  },
  hyrox: {
    key: "hyrox",
    name: "Hyrox",
    colors: {
      light: { accent: "#E11D48", accentDeep: "#BE123C", accentSoft: "#FCE0E5", accentInk: "#FFFFFF" },
      dark: { accent: "#FB7185", accentDeep: "#FDA4AF", accentSoft: "#3A1420", accentInk: "#131110" },
    },
    Icon: HyroxIcon,
  },
  marathon: {
    key: "marathon",
    name: "Marathon prep",
    colors: {
      light: { accent: "#0D9488", accentDeep: "#0F766E", accentSoft: "#D6F0EC", accentInk: "#FFFFFF" },
      dark: { accent: "#2DD4BF", accentDeep: "#5EEAD4", accentSoft: "#0F2E2A", accentInk: "#131110" },
    },
    Icon: MarathonIcon,
  },
};

// Falls back to gym for any unrecognized/not-yet-added key, same defensive pattern
// as the rest of the app's category handling (e.g. ProgramsScreen's `!p.live` filter).
export function categoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEMES[category as CategoryKey] || CATEGORY_THEMES.gym;
}
