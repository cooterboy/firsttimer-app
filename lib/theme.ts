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
