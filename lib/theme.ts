// Design tokens ported from spec/prototype.html's :root CSS variables.
// Keep this file in sync with the prototype — it is the source of truth.

export const lightColors = {
  ink: "#17140F",
  ink2: "#4A443A",
  paper: "#F4EFE4",
  raised: "#FFFFFF",
  sunken: "#ECE6D8",
  line: "#E2DAC8",
  muted: "#8A8272",
  accent: "#FF5E1A",
  accentInk: "#FFFFFF",
  accentSoft: "#FFE7D6",
  accentDeep: "#D94A0F",
  good: "#2E7D4F",
  goodSoft: "#DFF0E4",
  warn: "#A8780A",
  warnSoft: "#FBF0D0",
  bad: "#B3261E",
  badSoft: "#F8DEDC",
};

export const darkColors = {
  ink: "#F3EEE3",
  ink2: "#C9C2B3",
  paper: "#131110",
  raised: "#1D1A16",
  sunken: "#0E0D0B",
  line: "#312C25",
  muted: "#8F8878",
  accent: "#FF6E2C",
  accentInk: "#131110",
  accentSoft: "#3A2415",
  accentDeep: "#FF8A55",
  good: "#5FCB86",
  goodSoft: "#173322",
  warn: "#E0B341",
  warnSoft: "#332A12",
  bad: "#F28B82",
  badSoft: "#3A1A18",
};

export type ThemeColors = typeof lightColors;

// prototype's ACCENTS array (spec/prototype.html:1167) — "pink" exists in the
// prototype's CSS (:root[data-accent="pink"]) but was never wired into the
// ACCENTS array the settings picker actually renders, so it's unreachable
// there too — not ported here either.
export const ACCENTS: { k: import("./types").AccentKey; l: string; c: string }[] = [
  { k: "orange", l: "Safety orange", c: "#FF5E1A" },
  { k: "green", l: "Green", c: "#1F8A5B" },
  { k: "blue", l: "Blue", c: "#2563EB" },
  { k: "ink", l: "Ink", c: "#17140F" },
];

// prototype's :root[data-accent="..."] / dark-mode overrides (spec/prototype.html:33-46).
const accentOverrides: Record<
  import("./types").AccentKey,
  { light: Partial<ThemeColors>; dark: Partial<ThemeColors> }
> = {
  orange: { light: {}, dark: {} },
  green: {
    light: { accent: "#1F8A5B", accentDeep: "#166A45", accentSoft: "#D9F0E3", accentInk: "#FFFFFF" },
    dark: { accent: "#4ADE80", accentDeep: "#86EFAC", accentSoft: "#14321F", accentInk: "#131110" },
  },
  blue: {
    light: { accent: "#2563EB", accentDeep: "#1D4ED8", accentSoft: "#DCE7FD", accentInk: "#FFFFFF" },
    dark: { accent: "#60A5FA", accentDeep: "#93C5FD", accentSoft: "#14233D", accentInk: "#131110" },
  },
  ink: {
    light: { accent: "#17140F", accentDeep: "#000000", accentSoft: "#E6E1D5", accentInk: "#F6F1E7" },
    dark: { accent: "#F3EEE3", accentDeep: "#FFFFFF", accentSoft: "#2A2620", accentInk: "#131110" },
  },
};

// categoryOverride comes from lib/categoryThemes.ts via ThemeContext.tsx — kept as a
// plain Partial<ThemeColors> param here (rather than importing CategoryKey) so this
// file stays the color-token primitive, with no knowledge of "category" as a concept.
// Applied UNDER the accent override, so a category's default palette (once a second
// category ever ships real content) never overrides the user's own accent choice.
export function colorsFor(
  scheme: "light" | "dark",
  accent: import("./types").AccentKey,
  categoryOverride?: Partial<ThemeColors>
): ThemeColors {
  const base = scheme === "dark" ? darkColors : lightColors;
  const accentOverride = accentOverrides[accent]?.[scheme] || {};
  return { ...base, ...(categoryOverride || {}), ...accentOverride };
}

// prototype's --r
export const radius = 16;

// prototype's font-family map: Bebas Neue (display), Work Sans (body), JetBrains Mono (numbers)
export const fonts = {
  display: "BebasNeue_400Regular",
  body: "WorkSans_400Regular",
  bodyMedium: "WorkSans_500Medium",
  bodySemiBold: "WorkSans_600SemiBold",
  bodyBold: "WorkSans_700Bold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
};

// Sizes pulled from the prototype's type scale (h1.page-title, h2.big, h3.sub,
// .eyebrow, p.lede, p.note, .greet h1, .session-card h2, .logo .word, etc).
export const type = {
  displayHero: 64, // .welcome .mark
  displaySplash: 50, // .sp-line (clamp 42–58vw in the prototype; fixed for native)
  displayPageTitle: 34, // h1.page-title, .greet h1
  displayCardTitle: 40, // .session-card h2
  displayBig: 38, // h2.big
  displaySub: 22, // h3.sub
  displayWord: 24, // .logo .word
  displayTile: 34, // .tile b
  eyebrow: 11, // .eyebrow, field labels
  lede: 14, // p.lede
  note: 12, // p.note
  body: 14, // .row .k, .moves .mn
  bodySmall: 12, // .moves .mn small, .group .item .t small
  label: 13, // .group .item .r
  mono: 12, // .moves .ms
  monoValue: 13, // .row .v
};

// prototype's --shadow, split for iOS (shadow*) and Android (elevation)
export const shadow = {
  shadowColor: "#17140F",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 10,
  elevation: 3,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};
