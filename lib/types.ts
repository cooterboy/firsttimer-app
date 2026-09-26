import { BaseMovement, Letter, MovementType, RepStyleKey } from "./gymProgram";

export type Units = "imperial" | "metric";
export type Goal = "lose" | "build" | "energy" | "habit" | "confidence" | "event";

export type Profile = {
  name: string;
  units: Units;
  where: "gym";
  reps: RepStyleKey;
  length: number; // minutes: 30 | 45 | 60
  pain: string[]; // e.g. ["knees", "back", "shoulders"]
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
};
