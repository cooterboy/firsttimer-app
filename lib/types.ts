import { BaseMovement, Letter, MovementType, RepStyleKey } from "./gymProgram";

export type Units = "imperial" | "metric";
export type Goal = "lose" | "build" | "energy" | "habit" | "confidence" | "event";
// Matches the prototype's WHERE_LABEL keys. Only "gym" has its own movement bank
// ported (lib/gymProgram.ts's GYM) — the others are real, settable choices (so the
// data model and the UI aren't lying about what a beginner can pick), but session
// building falls back to GYM for all of them, same as the prototype's own
// `SETS[where] || GYM` fallback and its "Home programs are placeholders until the
// trainer writes them" copy. Porting real home/garage/hotel/outside movement banks
// is a separate, comparably-sized task, not done here.
export type Where = "gym" | "home_db" | "home_none" | "garage" | "hotel" | "outside";
export const WHERE_LABEL: Record<Where, string> = {
  gym: "At a gym",
  home_db: "Home, dumbbells",
  home_none: "Home, no equipment",
  garage: "Garage gym",
  hotel: "Hotel or travel",
  outside: "Outside",
};
export const PAIN_AREAS = ["knees", "back", "shoulders", "wrists", "neck"] as const;
export type PainArea = (typeof PAIN_AREAS)[number];
export function painAreaLabel(k: PainArea): string {
  return k === "back" ? "Lower back" : k[0].toUpperCase() + k.slice(1);
}

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
};

export type Settings = {
  restDefault: number;
  autoRest: boolean;
  warmup: boolean;
  cues: boolean;
  weighin: boolean;
  reminders: boolean;
  remindTime: string; // "7:00 am" style, matches the prototype
  mobility: "weekly" | "biweekly" | "off";
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
  letter: Letter;
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
  | { kind: "shortOnTime" }
  | null;

export type ActiveWorkout = {
  block: number;
  idx: number;
  letter: Letter;
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
