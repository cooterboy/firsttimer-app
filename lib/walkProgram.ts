// Ported from spec/prototype.html. Walk / jog / run is a log, not a program — walking
// is the default on purpose, the one thing a deconditioned beginner can do with no risk.
import { WalkKind } from "./types";

export const WALK_KINDS: { k: WalkKind; l: string; n: string }[] = [
  { k: "walk", l: "Walk", n: "Walk" },
  { k: "jog", l: "Jog", n: "Jog" },
  { k: "run", l: "Run", n: "Run" },
];

export const WALK_MINS = [10, 20, 30, 45];

export const WALK_HURT = ["Knees", "Shins", "Feet", "Hips", "Lower back", "Ankles", "Wrists", "Other joints"];

export function walkKindLabel(k: WalkKind): string {
  return WALK_KINDS.find((x) => x.k === k)?.n || "Walk";
}

// What gets said while they're out. The halfway cue is the useful one — beginners walk
// out twenty minutes and only then work out they have twenty minutes back.
export function walkCue(pct: number, kind: WalkKind): string {
  const out = kind === "run" ? "running" : kind === "jog" ? "jogging" : "walking";
  if (pct < 0.22) return "Settle into a pace you could hold a conversation at.";
  if (pct < 0.48) return "Good. Nothing to prove out here.";
  if (pct < 0.55) return "Halfway. Turn around.";
  if (pct < 0.82) return `Back half. This is where most people stop ${out} and start scrolling.`;
  if (pct < 0.97) return "Nearly in. Finish at the same pace you started.";
  return "Done.";
}
