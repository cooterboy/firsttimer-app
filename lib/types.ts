import { BaseMovement, MovementParams, MovementType, RepStyleKey } from "./gymProgram";

export type Units = "imperial" | "metric";
export type Goal = "lose" | "build" | "energy" | "habit" | "confidence" | "event";
export const GOAL_LABEL: Record<Goal, string> = {
  lose: "Lose fat",
  build: "Build muscle",
  energy: "Feel stronger day to day",
  habit: "Build the habit",
  confidence: "Feel at home in a gym",
  event: "Training for an event",
};
// Matches the prototype's WHERE_LABEL keys. `where` picks the plan: the first live
// program whose where_keys include it (lib/gymProgram.ts's selectProgram), else
// the gym plan — the prototype's `SETS[where] || GYM`. Only the gym plan (serving
// gym and garage) exists so far, so every other choice still gets it, matching
// the "Home programs are placeholders until the trainer writes them" copy. A home
// plan is database content (a programs row), not code.
export type Where = "gym" | "home_db" | "home_none" | "garage" | "hotel" | "outside";
export const WHERE_LABEL: Record<Where, string> = {
  gym: "At a gym",
  home_db: "Home, dumbbells",
  home_none: "Home, no equipment",
  garage: "Garage gym",
  hotel: "Hotel or travel",
  outside: "Outside",
};
// Keys match movement_alternatives.pain_area, so a movement can carry its own swap
// for any of them. Only knees, back and shoulders have swaps written so far; the
// rest are saved on the profile and swap nothing until content adds them.
export const PAIN_AREAS = ["knees", "back", "shoulders", "wrists", "neck", "hips", "ankles", "other"] as const;
export type PainArea = (typeof PAIN_AREAS)[number];
export function painAreaLabel(k: PainArea): string {
  if (k === "back") return "Lower back";
  if (k === "other") return "Other joints";
  return k[0].toUpperCase() + k.slice(1);
}

// prototype's onboarding step 2 "Days a week" — collected and stored, but not yet
// wired into daysPer()/planDays() (lib/gymProgram.ts:232-234, lib/sessionEngine.ts:41-44
// are still hardcoded to the 3-day plan). Threading a real 2-day plan through the
// session-building math (weeksPerBlock, rep progression, mobility scheduling) is a
// separate, comparably-sized task — same deliberate-gap pattern as `Where` above.
export type TrainingDays = 2 | 3;

export type Activity = "sedentary" | "light" | "active" | "back";
export const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: "Mostly sitting",
  light: "Some movement",
  active: "Already active",
  back: "Coming back after a break",
};

export type Why = "self" | "health" | "date" | "kids" | "friend";
export const WHY_LABEL: Record<Why, string> = {
  self: "For me",
  health: "A health check-up",
  date: "A date on the calendar",
  kids: "To keep up with my kids",
  friend: "A friend talked me into it",
};

export type Profile = {
  name: string;
  units: Units;
  where: Where;
  reps: RepStyleKey;
  length: number; // minutes: 30 | 45 | 60
  pain: PainArea[]; // e.g. ["knees", "back", "shoulders"]
  age: number | null;
  heightCm: number | null;
  weight: number | null; // in the profile's current `units`, like the prototype
  goal: Goal | null;
  days: TrainingDays;
  activity: Activity | null;
  why: Why | null;
  medicalDisclaimerAccepted: boolean;
  // Account-level, single-value fields backed by their own `profiles` columns —
  // moved here from Settings (which was jsonb) so they're real, individually
  // queryable columns like everything else in Profile. See migration 008.
  friendsOptIn: boolean;
  boxCode: string; // a linked First Timer box code, if any (state.boxCode) — no
  // real box/brand-partner backend exists, so linking here never actually
  // unlocks anything; see ShopScreen's "not yet connected" copy.
  city: string; // free-text city/zip for the Find-a-gym/Recovery map-search links
  // Set the first time recoverySignal() flips "hot" (see lib/sessionEngine.ts). Plan
  // days within RECOVERY_COOLDOWN_DAYS of this timestamp get a suggested mobility swap
  // instead of the scheduled lifting session. Cleared once the signal is no longer hot
  // after the cooldown; if it's still hot, the doctor/trainer escalation message shows
  // instead of clearing it.
  recoveryAdjustedAt: string | null;
  // The gym that gave them their box (lib/gyms.ts, migration 019). gymSetAt null =
  // never answered; set with gymCode null = "Somewhere else / I didn't get a box".
  gymCode: string | null;
  gymSetAt: string | null;
};

// A friend added via code (state.friends.list + state.friends.bumps merged into
// one row per friend — the prototype keeps them separate, but they're 1:1 here).
export type Friend = {
  id: string;
  name: string;
  code: string;
  bumped: boolean;
  date: string;
};

// A purchase record (state.purchases): one per store product owned — see
// lib/blockCatalog.ts. `productId` says which specific blocks it unlocks, and
// ownedBlocks() works from that. Records from before migration 016 have no
// productId; for those `blocks` (how many blocks it granted, in order) is used.
export type Purchase = {
  id: string; // a UUID; one per (account, product) — see lib/purchases.ts's purchaseId()
  label: string; // "Block 5" / "Blocks 2–4"
  price: number;
  blocks: number;
  productId?: string | null;
  date: string;
};

export type AccentKey = "orange" | "green" | "blue" | "ink";

export type Settings = {
  restDefault: number;
  autoRest: boolean;
  warmup: boolean;
  cues: boolean;
  weighin: boolean;
  reminders: boolean;
  remindTime: string; // "7:00 am" style, matches the prototype
  mobilityReminder: boolean; // push for mobility day — only actually schedules if
  // `mobility` (below) isn't "off"; see lib/notifications.ts
  recapReminder: boolean; // push for the Sunday recap
  mobility: "weekly" | "biweekly" | "off";
  accent: AccentKey;
  sounds: boolean;
  haptics: boolean;
  quotes: boolean; // prototype's "Opening card" — the daily-opener splash
  paused: boolean; // prototype's state.paused — "Pause my program"
  openerSeen: string; // dayKey() of the last daily-opener splash shown
  recapSeen: string; // weekKey() (as a string) of the last weekly-recap splash shown
};

// Ten timed stretches on a non-training day (prototype's state.mobility).
export type MobilityEntry = {
  id: string;
  date: string; // ISO
  minutes: number;
};

export type WalkKind = "walk" | "jog" | "run";

// A walk/jog/run, logged on its own — never touches the lifting streak
// (prototype's state.walks).
export type WalkEntry = {
  id: string;
  date: string; // ISO
  minutes: number;
  kind: WalkKind;
  feel: "" | "easy" | "right" | "hard";
  hurt: string[];
};

// A weekly body-weight log (prototype's state.weighins). Always stored in the
// profile's current units — convertProfileWeight-style conversion applies the
// same way session history weights do when units are switched.
export type WeighIn = {
  id: string;
  date: string; // ISO
  w: number;
};

// One movement's logged result inside a completed session (prototype's h.moves[name]).
export type HistoryMove = {
  w: string;
  setW: string[];
  feel: string;
  sets: number;
  reps: number;
  type: MovementType;
  note: string;
  mtags: string[];
};

export type HistoryEntry = {
  id: string; // client-generated UUID — the sync identity for this record
  block: number;
  idx: number;
  letter: string; // the session template's code, e.g. "A"
  week: number;
  date: string; // ISO
  moves: Record<string, HistoryMove>;
  note: string;
  minutes: number;
  tags?: string[];
  rating?: number;
  backfilled?: boolean;
};

// A movement inside an in-progress workout (prototype's wo.moves[i]).
export type ActiveMove = {
  n: string;
  cue: string;
  type: MovementType;
  spec: string;
  sets: number;
  rest: number;
  swapped: string;
  w: string;
  setW: string[];
  hadLast: boolean;
  done: number[];
  feel: "" | "easy" | "right" | "hard" | "skipped";
  suggested: string | null;
  hold: string;
  skipped: boolean;
  note?: string;
  mtags?: string[];
  fb?: { kind: "up" | "down" | "same"; text: string } | null;
  perSide?: boolean;
  why?: string; // "what it works" — exercises.why for whatever is being done now
  params?: MovementParams; // the slot's own; cleared when an alternative is swapped in
  orig: BaseMovement;
};

export type FinishCopy = {
  big: string;
  line: string;
  wins: string[];
  card: string;
  caption: string;
};

// The single bottom sheet the workout screen can have open at once, mirroring
// the prototype's one-sheet-at-a-time #sheet element.
export type SheetState =
  | { kind: "swap"; swapKind: "sub" | "easier" }
  | { kind: "hurt" }
  | { kind: "note" }
  | { kind: "findWeight" }
  | { kind: "info" }
  | { kind: "progress"; name: string }
  | { kind: "shortOnTime" }
  | null;

export type ActiveWorkout = {
  block: number;
  idx: number;
  letter: string;
  week: number;
  mi: number; // current move index
  moves: ActiveMove[];
  activeMs: number;
  segStart: number | null;
  dropSet?: boolean;
  celebrated?: boolean;
  logged?: boolean;
  fc?: FinishCopy;
  // Set when this session was started from Today's comeback card (10+ days away).
  // factor<1 eases prefilled weights down one time; factor===1 means "pick up at
  // my old weights" — no easing, but still recorded so the comeback card doesn't
  // show again for this position. Cleared once the session logs.
  comeback?: { factor: number } | null;
};
