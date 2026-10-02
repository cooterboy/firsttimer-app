// Ported from spec/prototype.html's workout engine (openWorkout, advance/goMove,
// setFeedback, moveSummary, applySwap, logSession, finishCopy, coachRead, nextPreview).
// Functions here are pure — they take state as arguments instead of reading a global
// `state`/`wo`, since React state is owned by the screens that call these.

import {
  BuiltSession,
  MovementVariant,
  Program,
  buildSession as buildSessionData,
  daysPer,
  restMultiplier,
  specFor,
  step,
  unit,
} from "./gymProgram";
import * as Crypto from "expo-crypto";
import { ActiveMove, ActiveWorkout, HistoryEntry, HistoryMove, MobilityEntry, Profile, Settings, WalkEntry, WalkKind, WeighIn } from "./types";
import { walkKindLabel } from "./walkProgram";

export const MOVE_TAGS = ["Form felt off", "Joint ache", "Machine confusing", "Grip gave out", "Felt great"];
export const SESSION_TAGS = [
  "Felt strong",
  "Tired",
  "Sore going in",
  "Short on time",
  "Slept well",
  "Slept badly",
  "Rushed",
  "Easy day",
  "Stressed",
  "Ate well",
  "Skipped a meal",
  "Form felt off",
  "Joint ache",
  "Best one yet",
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PLAN_DAYS = [0, 2, 4]; // Mon/Wed/Fri — v1's fixed 3-day plan

export function planDays(): number[] {
  return PLAN_DAYS;
}
export function nextTrainingDay(): { name: string; gap: number } {
  const today = (new Date().getDay() + 6) % 7;
  const next = PLAN_DAYS.find((d) => d > today);
  if (next !== undefined) return { name: DAY_NAMES[next], gap: next - today };
  return { name: DAY_NAMES[PLAN_DAYS[0]], gap: 7 - today + PLAN_DAYS[0] };
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---- history lookups ----
export function lastFor(name: string, history: HistoryEntry[]): HistoryMove | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i].moves[name];
    if (m && m.w) return m;
  }
  return null;
}
export function prevFor(name: string, block: number, idx: number, history: HistoryEntry[]): HistoryMove | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.block === block && h.idx === idx) continue;
    if (h.moves[name] && (h.moves[name].w || h.moves[name].sets)) return h.moves[name];
  }
  return null;
}
export function bestEver(name: string, history: HistoryEntry[]): { w: number; date: string } | null {
  let best: { w: number; date: string } | null = null;
  history.forEach((h) => {
    const m = h.moves[name];
    if (!m || m.type !== "weight") return;
    const w = Number(m.w) || 0;
    if (w && (!best || w > best.w)) best = { w, date: h.date };
  });
  return best;
}

// ---- building an active workout ----
export function buildSessionForProfile(program: Program, block: number, idx: number, profile: Profile): BuiltSession {
  return buildSessionData(program, block, idx, profile.length, profile.reps, profile.pain);
}

const warmupMovement = (profile: Profile): ActiveMove => ({
  n: "Warm-up",
  cue:
    profile.where === "gym"
      ? "Five easy minutes on a bike or treadmill. You should be able to talk the whole time."
      : "Five minutes: march in place, arm circles, bodyweight squats to a chair. Easy pace.",
  type: "reps",
  spec: "5 min",
  sets: 1,
  rest: 0,
  swapped: "",
  w: "",
  setW: [],
  hadLast: false,
  done: [],
  feel: "",
  suggested: null,
  hold: "",
  skipped: false,
  orig: { n: "Warm-up", cue: "", type: "reps", rest: 0 },
});

// prototype's openWorkout(): the bump/hold logic that decides each movement's
// starting weights from history, plus the warm-up movement stitched to the front.
export function prepareWorkoutMoves(
  built: BuiltSession,
  profile: Profile,
  settings: Settings,
  history: HistoryEntry[],
  comebackFactor?: number
): ActiveMove[] {
  const st = step(profile.units);
  // Only actually eases weights when <1 — "pick up at my old weights" passes a
  // factor of 1, which intentionally applies no easing at all.
  const cb = comebackFactor && comebackFactor < 1 ? comebackFactor : 0;
  const moves: ActiveMove[] = built.moves.map((m) => {
    const last = lastFor(m.n, history);
    const hist2 = history
      .filter((h) => h.moves[m.n] && h.moves[m.n].type === "weight")
      .slice(-2)
      .map((h) => h.moves[m.n]);
    let bump = last && last.feel === "easy" ? st : 0;
    let hold = "";
    if (hist2.length === 2 && hist2.every((x) => x.feel === "hard")) {
      bump = 0;
      hold = "Held: felt hard twice.";
    }
    if (hist2.length === 2 && hist2.every((x) => x.feel === "easy") && Number(hist2[1].w) <= Number(hist2[0].w)) {
      bump = st * 2;
      hold = `Up ${bump}: easy twice.`;
    }
    if (last && (last.mtags || []).includes("Joint ache")) {
      bump = 0;
      hold = "Held: joint ache last time. Go easier if it's still there.";
    }
    const setW: string[] = [];
    for (let i = 0; i < m.sets; i++) {
      let v = last ? (last.setW && last.setW[i]) || last.w || "" : "";
      if (v && bump) v = String(Number(v) + bump);
      if (v && cb) v = String(Math.max(st, Math.round((Number(v) * cb) / st) * st));
      setW.push(v);
    }
    // Overwrites any hold set above — being back after a while outranks the usual
    // "held because it felt hard" style notes.
    if (cb && last && last.w) hold = `Eased back ${Math.round((1 - cb) * 100)}% from ${last.w} ${unit(profile.units)}. Go up next session.`;
    return {
      n: m.n,
      cue: m.cue,
      type: m.type,
      spec: m.spec,
      sets: m.sets,
      rest: Math.round((m.rest || settings.restDefault) * restMultiplier(profile.reps)),
      swapped: m.swapped,
      w: setW[0] || "",
      setW,
      hadLast: !!last,
      done: [],
      feel: "",
      suggested: bump > 0 && last ? last.w : null,
      hold,
      skipped: false,
      perSide: m.perSide,
      why: m.why,
      params: m.params,
      orig: m.orig,
    };
  });
  if (settings.warmup) moves.unshift(warmupMovement(profile));
  return moves;
}

export function newActiveWorkout(
  built: BuiltSession,
  profile: Profile,
  settings: Settings,
  history: HistoryEntry[],
  comebackFactor?: number
): ActiveWorkout {
  return {
    block: built.block,
    idx: built.idx,
    letter: built.letter,
    week: built.week,
    mi: 0,
    moves: prepareWorkoutMoves(built, profile, settings, history, comebackFactor),
    activeMs: 0,
    segStart: Date.now(),
    comeback: comebackFactor != null ? { factor: comebackFactor } : null,
  };
}

// ---- moving around inside a session ----
export function isWarmup(m: ActiveMove): boolean {
  return m.n === "Warm-up";
}
export function moveDone(m: ActiveMove): boolean {
  if (m.skipped) return true;
  if (isWarmup(m)) return m.done.length > 0;
  return m.done.length >= m.sets && !!m.feel;
}
export function nextUndone(moves: ActiveMove[], from: number): number {
  const n = moves.length;
  for (let k = Math.max(0, from); k < n; k++) if (!moveDone(moves[k])) return k;
  for (let k = 0; k < Math.max(0, from) && k < n; k++) if (!moveDone(moves[k])) return k;
  return n;
}
export function moveNo(moves: ActiveMove[], i: number): number {
  const off = moves[0] && isWarmup(moves[0]) ? 1 : 0;
  return i + 1 - off;
}
export function nextLabel(moves: ActiveMove[], mi: number): string {
  const n = nextUndone(moves, mi + 1);
  if (n >= moves.length) return "Finish session";
  if (n > mi) return "Next movement";
  return `Back to move ${moveNo(moves, n)}`;
}

// ---- swaps ----
export function applySwap(m: ActiveMove, alt: MovementVariant, label: string, block: number, profile: Profile, history: HistoryEntry[]): ActiveMove {
  const type = alt.type || m.type;
  const perSide = alt.perSide !== undefined ? alt.perSide : m.perSide;
  const spec = specFor({ type, n: alt.n, perSide }, m.sets, block, profile.reps);
  const last = lastFor(alt.n, history);
  const w = last ? last.w : "";
  return {
    ...m,
    n: alt.n,
    cue: alt.cue,
    type,
    perSide,
    why: alt.why, // unset → the info sheet falls back to the original's
    params: undefined, // the slot's params describe its own exercise, not this one
    spec,
    swapped: label,
    done: [],
    feel: "",
    fb: null,
    w,
    setW: Array.from({ length: m.sets }, () => w),
    suggested: null,
  };
}

// ---- per-set and per-movement feedback ----
export function setFeedback(
  m: ActiveMove,
  i: number,
  block: number,
  idx: number,
  history: HistoryEntry[],
  profile: Profile,
  isComebackSession = false
): { kind: "up" | "down" | "same"; text: string } | null {
  if (m.type !== "weight") return null;
  const now = Number(m.setW[i]) || 0;
  if (!now) return null;
  const prev = prevFor(m.n, block, idx, history);
  if (!prev) return null;
  const was = Number((prev.setW && prev.setW[i]) || prev.w) || 0;
  if (!was) return null;
  const d = Math.round((now - was) * 10) / 10;
  const lastSet = i === m.sets - 1;
  const u = unit(profile.units);
  if (d > 0) {
    const best = bestEver(m.n, history);
    const pr = best && now > best.w;
    return {
      kind: "up",
      text: pr ? `Heaviest you've done on this. ${was} → ${now} ${u}.` : `Up ${d} ${u} on last time. ${lastSet ? "That's the session doing its job." : "Keep it there."}`,
    };
  }
  if (d < 0) {
    // Being lighter is the whole point of a comeback session — nothing to remark on.
    if (isComebackSession) return null;
    const best = bestEver(m.n, history);
    return {
      kind: "down",
      text: `Lighter than last time's ${was}. Sleep, food and a long week all show up here, and none of it undoes anything.${best ? ` Your best on this is ${best.w} ${u}, ${fmtDate(best.date)}.` : ""}`,
    };
  }
  return lastSet ? { kind: "same", text: `Same as last time at ${now} ${u}. Repeating a weight with better form is progress that doesn't show up as a number.` } : null;
}
export function moveSummary(m: ActiveMove, block: number, idx: number, history: HistoryEntry[]): { kind: "up" | "down"; text: string } | null {
  if (m.type !== "weight") return null;
  const prev = prevFor(m.n, block, idx, history);
  if (!prev) return null;
  const vol = (m.setW || []).filter((_, i) => m.done.includes(i)).reduce((a, v) => a + (Number(v) || 0), 0);
  const pv = (prev.setW && prev.setW.length ? prev.setW : [prev.w]).reduce((a, v) => a + (Number(v) || 0), 0);
  if (!vol || !pv) return null;
  const pct = Math.round(((vol - pv) / pv) * 100);
  if (pct > 0) return { kind: "up", text: `${pct}% more total weight on ${m.n} than last time.` };
  if (pct < 0) return { kind: "down", text: `${Math.abs(pct)}% under last time on ${m.n}. One session is noise; the chart under Progress is the signal.` };
  return null;
}

// ---- weight-finder hint (prototype's startHint) ----
export type WeightHint = { kind: "db" | "stack"; v: number | null; single: boolean; text: string };
export function startHint(m: ActiveMove, profile: Profile): WeightHint | null {
  if (m.type !== "weight") return null;
  const n = m.n;
  const p = m.params || {};
  const kg = profile.units === "metric";
  const u = unit(profile.units);
  // params (template_movements.params) win where set; otherwise the prototype's
  // name-based guess — which is all the gym program uses.
  const dumbbell = p.equipment ? p.equipment === "dumbbell" : /\bDB\b|dumbbell|goblet|farmer|suitcase|renegade|one-arm/i.test(n);
  if (dumbbell) {
    const lb = p.start_lb ?? (/shoulder press|floor press|romanian|bent-over|one-arm row/i.test(n) ? 10 : /carry/i.test(n) ? 20 : 15);
    const v = kg ? Math.round(lb / 2.2046 / 2.5) * 2.5 : lb;
    const single = p.single ?? /goblet|one-arm|suitcase/i.test(n);
    return {
      kind: "db",
      v,
      single,
      text: single
        ? `Start with one ${v} ${u} dumbbell. If the lightest one on the rack is heavier, take that.`
        : `Start with the ${v} ${u} dumbbells. If the lightest pair on the rack is heavier, take those.`,
    };
  }
  return {
    kind: "stack",
    v: null,
    single: false,
    text: "Start light: two or three plates up from the bottom of the stack, or the smallest plates the machine takes. Not the very bottom — you want to feel something.",
  };
}
export function guessStart(m: ActiveMove, i: number, profile: Profile, history: HistoryEntry[]): number {
  for (let k = i - 1; k >= 0; k--) {
    const v = Number(m.setW[k]);
    if (v > 0) return v;
  }
  const last = lastFor(m.n, history);
  if (last && Number(last.w) > 0) return Number(last.w);
  return profile.units === "metric" ? 10 : 20;
}

// ---- finishing a session ----
export function woElapsedMin(wo: ActiveWorkout): number {
  const ms = (wo.activeMs || 0) + (wo.segStart ? Date.now() - wo.segStart : 0);
  return Math.max(1, Math.round(ms / 60000));
}

export function logSessionEntry(wo: ActiveWorkout): HistoryEntry {
  const real = wo.moves.filter((m) => m.n !== "Warm-up");
  const entry: HistoryEntry = {
    id: Crypto.randomUUID(),
    block: wo.block,
    idx: wo.idx,
    letter: wo.letter,
    week: wo.week,
    date: new Date().toISOString(),
    moves: {},
    note: "",
    minutes: woElapsedMin(wo),
  };
  real.forEach((m) => {
    if (m.skipped) return;
    entry.moves[m.n] = {
      w: m.w,
      setW: (m.setW || []).filter((_, i) => m.done.includes(i)),
      feel: m.feel,
      sets: m.done.length,
      reps: Number((m.spec.match(/× (\d+)/) || [])[1]) || 0,
      type: m.type,
      note: m.note || "",
      mtags: m.mtags || [],
    };
  });
  return entry;
}

export function movedToday(real: ActiveMove[]): number {
  let t = 0;
  real.forEach((m) => {
    if (m.type !== "weight" || m.skipped) return;
    const reps = Number((m.spec.match(/× (\d+)/) || [])[1]) || 10;
    (m.setW || []).forEach((v, i) => {
      if (m.done.includes(i)) t += reps * (Number(v) || 0);
    });
  });
  return Math.round(t);
}

export function nextPreview(
  program: Program,
  block: number,
  session: number,
  profile: Profile
): { title: string; moves: string } {
  if (session >= program.blockSessions) return { title: "Block done", moves: "The next block picks up where this one ended." };
  const s = buildSessionForProfile(program, block, session, profile);
  const nt = nextTrainingDay();
  return { title: `${nt.name} · Session ${session + 1} · ${s.letter}`, moves: s.moves.map((m) => m.n).join(" · ") };
}

export type FinishCopy = { big: string; line: string; wins: string[]; card: string; caption: string };

export function finishCopy(
  wo: ActiveWorkout,
  real: ActiveMove[],
  blockDone: boolean,
  milestone: boolean,
  history: HistoryEntry[],
  profile: Profile,
  blockSessions: number
): FinishCopy {
  const days = daysPer();
  const inWeek = (wo.idx % days) + 1;
  const nt = nextTrainingDay();
  const total = history.length; // history already includes this session by the time this is called
  const u = unit(profile.units);
  const wins: string[] = [];
  real.forEach((m) => {
    if (m.type !== "weight" || !m.w || m.skipped) return;
    const priorEntries = history.slice(0, -1);
    const prev = [...priorEntries].reverse().find((h) => h.moves[m.n] && h.moves[m.n].w);
    if (prev && Number(m.w) > Number(prev.moves[m.n].w)) {
      wins.push(`${m.n} went up ${Math.round((Number(m.w) - Number(prev.moves[m.n].w)) * 10) / 10} ${u}.`);
    }
  });
  const skipped = real.filter((m) => m.skipped).length;
  let big: string, line: string, card: string;
  if (blockDone) {
    big = `Block ${wo.block} done.`;
    line = `${blockSessions} sessions. Most people never get past three.`;
    card = `BLOCK ${wo.block} DONE`;
  } else if (total === 1) {
    big = "Session 1. Done.";
    line = `The hardest one to start is behind you. See you ${nt.name}.`;
    card = "SESSION 1 DONE";
  } else if (milestone) {
    big = `Week ${wo.week} done.`;
    line = "Four weeks in a row. That's a habit now. See you " + nt.name + ".";
    card = `WEEK ${wo.week} DONE`;
  } else if (inWeek === days) {
    big = "That's the week.";
    line = `All ${days} sessions in. Rest up. See you ${nt.name}.`;
    card = `WEEK ${wo.week} · ${days} OF ${days}`;
  } else {
    const ord = ["First", "Second", "Third"][inWeek - 1] || "Next";
    big = `${ord} session of the week done.`;
    line = `${days - inWeek} to go this week. See you ${nt.name}${nt.gap === 2 ? ", in two days" : ""}.`;
    card = `WEEK ${wo.week} · ${inWeek} OF ${days}`;
  }
  if (skipped) wins.push(`You skipped ${skipped} that hurt. That's the right call, not a miss.`);
  if (!wins.length && total > 1 && !blockDone) {
    const ws = ["Showing up is the whole program.", "Same weights as last time still counts. Consistency first, then load.", `${total} sessions logged. Every one of them is data now.`];
    wins.push(ws[total % ws.length]);
  }
  const caption = blockDone
    ? `Block ${wo.block} of my First Timer gym program done. Started from zero. #firsttimer`
    : `Week ${wo.week}, session ${inWeek} of ${days}. First Timer, started from zero. #firsttimer`;
  return { big, line, wins, card, caption };
}

export function coachRead(wo: ActiveWorkout, real: ActiveMove[], isFirst: boolean, history: HistoryEntry[], profile: Profile): string[] {
  const u = unit(profile.units);
  const st = step(profile.units);
  const out: string[] = [];
  const easy = real.filter((m) => m.feel === "easy" && !m.skipped);
  const hard = real.filter((m) => m.feel === "hard" && !m.skipped);
  const skipped = real.filter((m) => m.skipped);
  const partial = real.filter((m) => !m.skipped && m.done.length < m.sets);
  if (isFirst && history.length === 1) out.push("Expect to be sore tomorrow and the day after. That's the muscle noticing, not damage. It fades by session three.");
  if (easy.length) out.push(`${easy.map((m) => m.n).join(", ")} felt easy: next time the weight is already bumped ${st} ${u}. If every rep is still easy, bump it again.`);
  if (hard.length) out.push(`${hard.map((m) => m.n).join(", ")} felt hard: stay at that weight next time. Hard with good form is the goal, not the problem.`);
  if (skipped.length) out.push(`You skipped ${skipped.map((m) => m.n).join(", ")} because it hurt. Right call. If it's still there next session, use the swap instead of pushing through.`);
  if (partial.length) out.push(`${partial.map((m) => m.n).join(", ")} ended short of the set count. Fine. The count is a target, not a test.`);
  const mins = woElapsedMin(wo);
  if (mins > 60) out.push(`${mins} minutes is longer than it needs to be. Try skipping rests under 45 seconds; the program works at 35–45 minutes.`);
  if (!out.length) out.push("Every set done, nothing hurt, nothing felt off. That's the session the whole program is built on. Same again next time, a little heavier where it felt easy.");
  if (!isFirst && wo.week === 2) out.push("Week 2 adds a third set. Expect the last one to feel harder than the first two. That's the point.");
  return out.slice(0, 3);
}

// ---- retest: "week one against now" (prototype's liftDeltas + paywallProof) ----
export function weekKey(d: string | Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

export function liftDeltas(history: HistoryEntry[]): Record<string, { first: number; last: number; count: number; delta: number }> {
  const out: Record<string, { first: number; last: number; count: number; delta: number }> = {};
  history.forEach((h) =>
    Object.keys(h.moves).forEach((n) => {
      const m = h.moves[n];
      if (m.type !== "weight" || !m.w) return;
      if (!out[n]) out[n] = { first: Number(m.w), last: Number(m.w), count: 0, delta: 0 };
      out[n].last = Number(m.w);
      out[n].count++;
    })
  );
  Object.keys(out).forEach((n) => {
    out[n].delta = Math.round((out[n].last - out[n].first) * 10) / 10;
  });
  return out;
}

// Every logged instance of one movement, in order — the source for both the Lifts
// list and the per-movement detail screen (prototype's liftSeries()).
export type LiftPoint = {
  date: string;
  block: number;
  idx: number;
  week: number;
  top: number; // heaviest set that session
  vol: number; // sets × reps × weight, added up
  sets: number;
  reps: number;
  feel: string;
  note: string;
  mtags: string[];
};
// Whole weeks between two sessions, rounded, at least 1 — for "Up 15 lb in 6 weeks".
export function weeksBetween(fromIso: string, toIso: string): number {
  const days = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000;
  return Math.max(1, Math.round(days / 7));
}
export function weeksLabel(n: number): string {
  return `${n} week${n === 1 ? "" : "s"}`;
}

// Other exercises this movement was done as — a swap, easier or pain version
// logged in its place — with how many sessions each. History keys a session's
// movements by what was actually done, not what it replaced, so a session counts
// only if it's one of this movement's own template (Leg press → Session A) and this
// movement wasn't logged in it; then any of its alternatives that were logged
// count, once per session. (Goblet squat in Session B is its own slot, so it never
// counts toward Leg press.) Most-done first.
export function alsoDoneAs(name: string, program: Program, history: HistoryEntry[]): { name: string; count: number }[] {
  const altsByCode = new Map<string, Set<string>>();
  for (const t of program.templates) {
    for (const m of t.moves) {
      if (m.n !== name) continue;
      const alts = altsByCode.get(t.code) ?? new Set<string>();
      for (const v of [m.sub, m.easier, ...Object.values(m.pain || {})]) if (v && v.n !== name) alts.add(v.n);
      altsByCode.set(t.code, alts);
    }
  }
  const counts = new Map<string, number>();
  for (const h of history) {
    const alts = altsByCode.get(h.letter);
    if (!alts || h.moves[name]) continue;
    for (const a of alts) if (h.moves[a]) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts].map(([n, count]) => ({ name: n, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Weighted movements in the program with no weights logged under their own name
// that were done through a swap instead — the rows Progress → Lifts adds so a
// movement that's only ever been swapped still has a way into its sheet (and its
// "Also done as" line). One per name, in program order.
export function swapOnlyLifts(program: Program, history: HistoryEntry[]): { name: string; doneAs: { name: string; count: number }[] }[] {
  const seen = new Set<string>();
  const out: { name: string; doneAs: { name: string; count: number }[] }[] = [];
  for (const t of program.templates) {
    for (const m of t.moves) {
      if (m.type !== "weight" || seen.has(m.n)) continue;
      seen.add(m.n);
      if (liftSeries(m.n, history).length) continue;
      const doneAs = alsoDoneAs(m.n, program, history);
      if (doneAs.length) out.push({ name: m.n, doneAs });
    }
  }
  return out;
}

export function liftSeries(name: string, history: HistoryEntry[]): LiftPoint[] {
  const out: LiftPoint[] = [];
  history.forEach((h) => {
    const m = h.moves[name];
    if (!m || m.type !== "weight") return;
    const ws = (m.setW || []).map(Number).filter((v) => v > 0);
    const top = ws.length ? Math.max(...ws) : Number(m.w) || 0;
    if (!top) return;
    const reps = m.reps || 0;
    const sets = m.sets || ws.length || 0;
    const vol = ws.length ? ws.reduce((a, v) => a + v * reps, 0) : top * reps * sets;
    out.push({ date: h.date, block: h.block, idx: h.idx, week: h.week, top, vol, sets, reps, feel: m.feel || "", note: m.note || "", mtags: m.mtags || [] });
  });
  return out;
}

// ---- body weight (prototype's weighedThisWeek/weeklyWeights) ----
export function weighedThisWeek(weighins: WeighIn[]): boolean {
  const k = weekKey(new Date());
  return weighins.some((w) => weekKey(w.date) === k);
}
// One point per week — the latest weigh-in logged that week — for the trend chart.
export function weeklyWeights(weighins: WeighIn[]): WeighIn[] {
  const map: Record<number, WeighIn> = {};
  weighins.forEach((w) => {
    map[weekKey(w.date)] = w;
  });
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => map[k]);
}

export type RetestSummary = {
  weeks: number;
  sessions: number;
  liftsUp: number;
  movedLabel: string;
  firstDate: string;
  rows: { name: string; first: number; last: number; pct: number }[];
};

// prototype's paywallProof(): first logged weight vs latest, per movement, since the
// block (or program) started. Shown when a block completes ("session 24 vs session 1").
export function retestSummary(history: HistoryEntry[], units: Profile["units"]): RetestSummary | null {
  const done = history.length;
  if (done < 1) return null;
  const d = liftDeltas(history);
  const rows = Object.keys(d)
    .filter((n) => d[n].count >= 2 && d[n].first)
    .sort((a, b) => d[b].delta - d[a].delta)
    .map((n) => ({ name: n, first: d[n].first, last: d[n].last, pct: Math.round(((d[n].last - d[n].first) / d[n].first) * 100) }));
  const weeks = new Set(history.map((h) => weekKey(h.date))).size;
  let moved = 0;
  history.forEach((h) =>
    Object.keys(h.moves).forEach((n) => {
      const m = h.moves[n];
      if (m.type !== "weight") return;
      if (m.setW && m.setW.length) m.setW.forEach((v) => (moved += (m.reps || 10) * (Number(v) || 0)));
      else if (m.w) moved += (m.sets || 0) * (m.reps || 10) * Number(m.w);
    })
  );
  const movedLabel = moved >= 1000 ? (moved / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(moved));
  const liftsUp = rows.filter((r) => r.pct > 0).length;
  return { weeks, sessions: done, liftsUp, movedLabel, firstDate: history[0].date, rows };
}

// Dev-only: fabricate plausible history for testing block-end screens (retest table,
// "block done" copy) without actually playing through 23 real sessions first. Leaves
// the last session of the block for a real playthrough.
export function devSeedNearBlockEnd(program: Program, block: number): HistoryEntry[] {
  const count = program.blockSessions - 1;
  const entries: HistoryEntry[] = [];
  const startWeight: Record<string, number> = {};
  for (let idx = 0; idx < count; idx++) {
    const template = program.templates[idx % program.templates.length];
    const letter = template.code;
    const daysAgo = (count - idx) * 2;
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const moves: HistoryEntry["moves"] = {};
    template.moves.forEach((m) => {
      if (m.type !== "weight") {
        moves[m.n] = { w: "", setW: [], feel: "right", sets: 3, reps: 0, type: m.type, note: "", mtags: [] };
        return;
      }
      if (!(m.n in startWeight)) startWeight[m.n] = /db|dumbbell|goblet/i.test(m.n) ? 15 : 40;
      const bumps = Math.floor(idx / 3);
      const w = startWeight[m.n] + bumps * 5;
      moves[m.n] = { w: String(w), setW: [String(w), String(w), String(w)], feel: "right", sets: 3, reps: 10, type: "weight", note: "", mtags: [] };
    });
    entries.push({
      id: `dev-seed-${block}-${idx}`,
      block,
      idx,
      letter,
      week: Math.floor(idx / daysPer()) + 1,
      date,
      moves,
      note: "",
      minutes: 38,
    });
  }
  return entries;
}

// prototype's inline "total weight moved" calc, reused on Progress and the retest card.
export function historyMovedTotal(history: HistoryEntry[]): number {
  let moved = 0;
  history.forEach((h) =>
    Object.keys(h.moves).forEach((n) => {
      const m = h.moves[n];
      if (m.type !== "weight") return;
      if (m.setW && m.setW.length) m.setW.forEach((v) => (moved += (m.reps || 10) * (Number(v) || 0)));
      else if (m.w) moved += (m.sets || 0) * (m.reps || 10) * Number(m.w);
    })
  );
  return Math.round(moved);
}
export function movedLabel(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
}

// prototype's setsTxt(): the compact "then vs now" style summary for a movement row.
export function setsSummary(m: HistoryMove, units: Profile["units"]): string {
  const u = unit(units);
  if (!m.w && !(m.setW || []).some((v) => v)) return "no weight";
  if (m.setW && m.setW.length > 1 && m.setW.some((v) => v !== m.setW[0])) return `${m.setW.join("/")} ${u}`;
  return `${m.w || "—"} ${u}`;
}

// prototype's convertUnits(): every stored weight gets converted in place when the
// person flips lb/kg, so old numbers keep meaning what they meant. lb<->kg only —
// no other field changes.
function convNum(to: "imperial" | "metric") {
  const f = to === "metric" ? (v: number) => Math.round((v / 2.2046) * 2) / 2 : (v: number) => Math.round(v * 2.2046);
  return (v: string | null | undefined): string | null => {
    const n = Number(v);
    if (v === "" || v === null || v === undefined || !isFinite(n) || n <= 0) return (v as string) ?? null;
    return String(f(n));
  };
}
export function convertHistoryUnits(history: HistoryEntry[], to: "imperial" | "metric"): HistoryEntry[] {
  const conv = convNum(to);
  return history.map((h) => {
    const moves: HistoryEntry["moves"] = {};
    Object.keys(h.moves).forEach((k) => {
      const m = h.moves[k];
      if (m.type !== "weight") {
        moves[k] = m;
        return;
      }
      moves[k] = { ...m, w: conv(m.w) || "", setW: (m.setW || []).map((v) => conv(v) || v) };
    });
    return { ...h, moves };
  });
}
export function convertProfileWeight(weight: number | null, to: "imperial" | "metric"): number | null {
  if (weight === null) return null;
  const conv = convNum(to);
  const out = conv(String(weight));
  return out === null ? null : Number(out);
}

// ---- nutrition card (prototype's "Recovery, in four lines") ----
const ACTIVITY_FACTOR: Record<string, number> = { sedentary: 1.35, light: 1.5, active: 1.65, back: 1.4 };
const GOAL_CAL_ADJUST: Record<string, number> = { lose: -400, build: 250, energy: 0, habit: 0, confidence: 0, event: 150 };
const GOAL_CAL_SUB: Record<string, string> = {
  lose: "About 400 under maintenance. Slow is what sticks.",
  build: "About 250 over maintenance. Most of it protein.",
  energy: "Around maintenance. Eat to train.",
  habit: "Around maintenance. Don't change two things at once.",
  confidence: "Around maintenance. Eat to train.",
  event: "A little over maintenance on long days.",
};

export function weightKg(weight: number | null, units: Profile["units"]): number {
  const w = weight || 0;
  return units === "metric" ? w : w / 2.2046;
}

export function calorieRange(profile: Profile): [number, number] | null {
  const kg = weightKg(profile.weight, profile.units);
  const cm = profile.heightCm || 0;
  const age = profile.age || 0;
  if (!kg || !cm || !age) return null;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  const act = (profile.activity && ACTIVITY_FACTOR[profile.activity]) || 1.45;
  const adj = (profile.goal && GOAL_CAL_ADJUST[profile.goal]) || 0;
  const lo = (base - 161) * act + adj;
  const hi = (base + 5) * act + adj;
  const r = (v: number) => Math.round(v / 50) * 50;
  return [r(lo), r(hi)];
}

export type NutritionCard = {
  protein: string;
  water: string;
  calorieLine: string;
  calorieSub: string;
  hasData: boolean;
};

export function nutritionCard(profile: Profile): NutritionCard {
  const kg = weightKg(profile.weight, profile.units);
  const pLo = profile.goal === "lose" ? 1.8 : 1.6;
  const pHi = 2.2;
  const protein = kg ? `${Math.round(kg * pLo)}–${Math.round(kg * pHi)} g` : "1.6–2.2 g per kg";
  const water = kg ? `${((Math.round((kg * 35) / 250) * 250) / 1000).toFixed(2).replace(/\.?0+$/, "")} L` : "35 ml per kg";
  const cal = calorieRange(profile);
  const calorieLine = cal ? `${cal[0].toLocaleString()}–${cal[1].toLocaleString()}` : "Add height & age";
  const calorieSub = cal ? GOAL_CAL_SUB[profile.goal || ""] || "Around maintenance." : "Fill in your details above, and this fills in.";
  return { protein, water, calorieLine, calorieSub, hasData: !!kg };
}

// ---- backfill: "trained and never opened the app" (prototype's SUB.backfill) ----
// Always targets the CURRENT pending session (block/session), same as the prototype —
// there's exactly one session you could plausibly have missed logging: the next one up.
export function buildBackfillEntry(
  program: Program,
  block: number,
  idx: number,
  profile: Profile,
  date: Date,
  weightsByMove: Record<string, string>
): HistoryEntry {
  const built = buildSessionForProfile(program, block, idx, profile);
  const moves: HistoryEntry["moves"] = {};
  built.moves.forEach((m) => {
    const w = (weightsByMove[m.n] || "").trim();
    moves[m.n] = {
      w,
      setW: w ? Array.from({ length: m.sets }, () => w) : [],
      feel: "",
      sets: m.sets,
      reps: Number((m.spec.match(/× (\d+)/) || [])[1]) || 0,
      type: m.type,
      note: "",
      mtags: [],
    };
  });
  return {
    id: Crypto.randomUUID(),
    block,
    idx,
    letter: built.letter,
    week: built.week,
    date: date.toISOString(),
    moves,
    note: "",
    minutes: 0,
    backfilled: true,
  };
}

export function trainedToday(history: HistoryEntry[]): boolean {
  const k = new Date();
  k.setHours(0, 0, 0, 0);
  return history.some((h) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === k.getTime();
  });
}

export function trainedYesterday(history: HistoryEntry[]): boolean {
  const k = new Date();
  k.setHours(0, 0, 0, 0);
  k.setDate(k.getDate() - 1);
  return history.some((h) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === k.getTime();
  });
}

// ---- comeback: "been a minute" (prototype's isComeback/daysAway) ----
export const AWAY_DAYS = 10;
export function daysAway(lastDate: string | null): number {
  return lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 0;
}
export function isComeback(
  history: HistoryEntry[],
  lastDate: string | null,
  paused = false,
  recoveryAdjustedAt: string | null = null
): boolean {
  const gap = daysAway(lastDate) - recoveryProtectedDays(lastDate, recoveryAdjustedAt);
  return history.length > 0 && gap >= AWAY_DAYS && !paused;
}
// prototype's `lighter(w)`: ~15% lighter for one session back, rounded to a step.
export function comebackWeight(w: number, units: Profile["units"]): number {
  const st = step(units);
  return Math.max(st, Math.round((w * 0.85) / st) * st);
}

// ---- recovery signal (shared by RecoveryScreen's soreness read and the recovery
// escalation on Today — one tag-threshold system, not two separate detectors) ----
export const RECOVERY_COOLDOWN_DAYS = 3;
// Deliberate divergence from the prototype (which has no such gate, spec/prototype.html:3270-3272):
// once "hot" started driving a real mobility swap + reschedule + doctor/trainer escalation
// instead of just a copy change, triggering it off someone's 1st or 2nd session (possible
// before this gate, since `ache` counts tagged movements, not sessions) was too aggressive
// a call to make on that little data. Product decision, not a bug fix.
export const RECOVERY_MIN_SESSIONS = 5;

export type RecoverySignal = { hot: boolean; ache: number; sore: number };

export function recoverySignal(history: HistoryEntry[]): RecoverySignal {
  const recent = history.slice(-6);
  const sore = recent.filter((h) => (h.tags || []).includes("Sore going in")).length;
  const ache = recent.reduce(
    (a, h) => a + Object.keys(h.moves).filter((n) => (h.moves[n].mtags || []).includes("Joint ache")).length,
    0
  );
  const enoughHistory = history.length >= RECOVERY_MIN_SESSIONS;
  return { hot: enoughHistory && (ache >= 2 || sore >= 3), ache, sore };
}

// Same shape and window as recoverySignal() above, reusing RECOVERY_MIN_SESSIONS
// rather than a near-duplicate constant — the one new pattern the "Noticed" section
// adds on top of recovery/plateau (see TodayScreen.tsx).
export type TiredSignal = { tired: boolean; count: number };

export function tiredSignal(history: HistoryEntry[]): TiredSignal {
  const recent = history.slice(-6);
  const count = recent.filter((h) => (h.tags || []).includes("Tired")).length;
  const enoughHistory = history.length >= RECOVERY_MIN_SESSIONS;
  return { tired: enoughHistory && count >= 3, count };
}

// Whether a recovery adjustment (profile.recoveryAdjustedAt) is still inside its
// cooldown window — the plan days that get a suggested mobility swap instead of the
// scheduled lifting session. Once this returns false, the caller re-checks
// recoverySignal(): still hot means escalate, otherwise the adjustment clears.
export function recoveryCooldownActive(recoveryAdjustedAt: string | null): boolean {
  if (!recoveryAdjustedAt) return false;
  const days = (Date.now() - new Date(recoveryAdjustedAt).getTime()) / 86400000;
  return days >= 0 && days < RECOVERY_COOLDOWN_DAYS;
}

// How many of the days between lastDate and now fall inside the (bounded, 3-day)
// recovery cooldown window — those were the app's own suggestion to skip lifting, not
// a lapse, so the comeback/streak-reset gap check below excludes them. Only the
// original cooldown window counts, even if recoveryAdjustedAt is still set much later
// because the signal escalated (still hot after the cooldown) — this never grows into
// an open-ended exemption. Never used for daysAway()'s literal "N days away" display,
// only for the >= AWAY_DAYS decision.
export function recoveryProtectedDays(lastDate: string | null, recoveryAdjustedAt: string | null): number {
  if (!lastDate || !recoveryAdjustedAt) return 0;
  const windowStart = new Date(recoveryAdjustedAt).getTime();
  const windowEnd = windowStart + RECOVERY_COOLDOWN_DAYS * 86400000;
  const overlapStart = Math.max(windowStart, new Date(lastDate).getTime());
  const overlapEnd = Math.min(windowEnd, Date.now());
  return Math.max(0, (overlapEnd - overlapStart) / 86400000);
}

// ---- plateau signal (same pattern as recoverySignal() above: a pure, derived read of
// history, no persisted state, reused by both the detection and the suggestion it
// drives) ----
export const PLATEAU_MIN_SESSIONS = 4;

export type PlateauSignal = { plateaued: boolean; sessions: number };

// A movement is plateaued if its logged top-set weight (HistoryMove.w — already "max of
// whatever's filled in", see SessionDetailSheet's commitSetEdit) hasn't gone up across
// its last PLATEAU_MIN_SESSIONS occurrences, and neither the session ("Easy day") nor
// the movement itself (feel === "easy") was ever tagged easy in that stretch — someone
// genuinely coasting through it isn't stuck, they just haven't been pushed yet.
export function plateauSignal(history: HistoryEntry[], name: string): PlateauSignal {
  const occurrences = history.filter((h) => h.moves[name] && h.moves[name].type === "weight" && h.moves[name].w);
  if (occurrences.length < PLATEAU_MIN_SESSIONS) return { plateaued: false, sessions: occurrences.length };
  const recent = occurrences.slice(-PLATEAU_MIN_SESSIONS);
  const weights = recent.map((h) => Number(h.moves[name].w) || 0);
  const everIncreased = weights.some((w, i) => i > 0 && w > weights[i - 1]);
  const feltEasy = recent.some((h) => (h.tags || []).includes("Easy day") || h.moves[name].feel === "easy");
  return { plateaued: !everIncreased && !feltEasy, sessions: occurrences.length };
}

// ---- mobility day (prototype's mobilityDue/mobilityToday) ----
// Logged separately from sessions on purpose (see below): the streak, milestones and
// month-two number all measure lifting, so neither of these ever touches it.
export function mobilityDue(mobility: MobilityEntry[], frequency: Settings["mobility"]): boolean {
  if (frequency === "off") return false;
  const k = weekKey(new Date());
  if (mobility.some((m) => weekKey(m.date) === k)) return false;
  if (frequency === "biweekly") {
    const last = mobility[mobility.length - 1];
    if (last && k - weekKey(last.date) < 14 * 86400000) return false;
  }
  return true;
}
export function mobilityToday(mobility: MobilityEntry[]): boolean {
  const k = new Date();
  k.setHours(0, 0, 0, 0);
  return mobility.some((m) => {
    const d = new Date(m.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === k.getTime();
  });
}
export function newMobilityEntry(minutes: number): MobilityEntry {
  return { id: Crypto.randomUUID(), date: new Date().toISOString(), minutes };
}
export function newWeighIn(w: number): WeighIn {
  return { id: Crypto.randomUUID(), date: new Date().toISOString(), w };
}
// prototype's finishMob(): what gets said depends on whether they also lifted today,
// whether it's their first ever, and round-number milestones every four blocks.
// A mobility day counts once at least this many stretches were held all the way
// through — or skipped with "This hurts", which is honest use of a safety option,
// not skipping. Next or a swipe past a stretch doesn't count it.
export const MOBILITY_MIN_HELD = 1;
export function mobilityDayCounts(held: number): boolean {
  return held >= MOBILITY_MIN_HELD;
}

export function mobilityFinishCopy(
  mobility: MobilityEntry[],
  minutes: number,
  alsoLifted: boolean
): { big: string; line: string } {
  const nt = nextTrainingDay();
  const count = mobility.length;
  if (alsoLifted)
    return {
      big: "Overachiever.",
      line: `A session and a mobility day, same day. That's the pair almost nobody does. See you ${nt.name}.`,
    };
  if (count === 1)
    return {
      big: "Loose. Done.",
      line: `Your first mobility day. This is the part everyone skips and then wishes they hadn't. ${nt.name} will feel different.`,
    };
  if (count % 4 === 0)
    return {
      big: `${count} mobility days.`,
      line: `Four blocks of the thing nobody does. Your hips will keep saying thank you. See you ${nt.name}.`,
    };
  return {
    big: "Loose. Done.",
    line: `${minutes} minutes on the floor while everyone else scrolled. Next session is ${nt.name} and you'll feel this one then.`,
  };
}

// ---- walk / jog / run (prototype's walksOn/finishWalk) ----
export function walksOn(walks: WalkEntry[], d: Date): WalkEntry[] {
  const k = new Date(d);
  k.setHours(0, 0, 0, 0);
  return walks.filter((w) => {
    const x = new Date(w.date);
    x.setHours(0, 0, 0, 0);
    return x.getTime() === k.getTime();
  });
}
export function walkMinutesToday(walks: WalkEntry[]): number {
  return walksOn(walks, new Date()).reduce((a, w) => a + (w.minutes || 0), 0);
}
export function movedDaysThisWeek(walks: WalkEntry[]): number {
  const wk = weekKey(new Date());
  const days = new Set<string>();
  walks.forEach((w) => {
    if (weekKey(w.date) === wk) days.add(new Date(w.date).toDateString());
  });
  return days.size;
}
export function newWalkEntry(kind: WalkKind, minutes: number): WalkEntry {
  return { id: Crypto.randomUUID(), date: new Date().toISOString(), minutes, kind, feel: "", hurt: [] };
}
// prototype's renderWalkDone(): what gets said depends on whether they also lifted
// today, whether it's their first ever, or they've hit four-plus days moving this week.
export function walkFinishCopy(
  walks: WalkEntry[],
  entry: WalkEntry,
  lifted: boolean
): { big: string; line: string } {
  const count = walks.length;
  const moved = movedDaysThisWeek(walks);
  const kind = walkKindLabel(entry.kind).toLowerCase();
  if (lifted) return { big: "Both, in one day.", line: `A session and a ${kind}. That's more than almost anyone does in a week.` };
  if (count === 1)
    return {
      big: "That counts.",
      line: "Your first one logged. Moving on the days between sessions is the part that makes the sessions feel easier.",
    };
  if (moved >= 4) return { big: `${moved} days moving this week.`, line: "That's a habit, not a streak. Keep it boring and it keeps working." };
  return { big: "Logged.", line: `${entry.minutes} minutes you didn't have to do. It adds up faster than anything you'll feel day to day.` };
}

// ---- data export (prototype's historyCsv()) ----
// One row per movement per session, plus one row each for mobility days and
// walks/runs — the shape a spreadsheet actually wants.
export function historyCsv(
  history: HistoryEntry[],
  units: Profile["units"],
  mobility: MobilityEntry[] = [],
  walks: WalkEntry[] = [],
  weighins: WeighIn[] = []
): string {
  const q = (v: unknown) => `"${String(v === undefined || v === null ? "" : v).replace(/"/g, '""')}"`;
  const u = unit(units);
  const rows: (string | number)[][] = [
    [
      "date",
      "block",
      "session",
      "week",
      "letter",
      "minutes",
      "rating",
      "session_tags",
      "session_note",
      "movement",
      "type",
      "sets",
      "reps",
      `weight_${u}`,
      "sets_detail",
      "feel",
      "movement_tags",
      "movement_note",
    ],
  ];
  [...history]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((h) => {
      Object.keys(h.moves).forEach((n) => {
        const m = h.moves[n];
        rows.push([
          h.date,
          h.block,
          h.idx + 1,
          h.week,
          h.letter,
          h.minutes || "",
          h.rating || "",
          (h.tags || []).join("; "),
          h.note || "",
          n,
          m.type || "",
          m.sets || "",
          m.reps || "",
          m.w || "",
          (m.setW || []).join(" / "),
          m.feel || "",
          (m.mtags || []).join("; "),
          m.note || "",
        ]);
      });
    });
  mobility.forEach((x) => {
    rows.push([x.date, "", "", "", "", x.minutes || "", "", "", "", "Mobility day", "mobility", "", "", "", "", "", "", ""]);
  });
  walks.forEach((w) => {
    rows.push([
      w.date,
      "",
      "",
      "",
      "",
      w.minutes || "",
      "",
      "",
      "",
      walkKindLabel(w.kind),
      "cardio",
      "",
      "",
      "",
      "",
      w.feel || "",
      (w.hurt || []).join("; "),
      "",
    ]);
  });
  weighins.forEach((w) => {
    rows.push([w.date, "", "", "", "", "", "", "", "", "Weigh-in", "bodyweight", "", "", w.w, "", "", "", ""]);
  });
  return rows.map((r) => r.map(q).join(",")).join("\r\n");
}

export type ExportSnapshot = {
  exportedAt: string;
  profile: Profile;
  settings: Settings;
  block: number;
  session: number;
  streak: number;
  lastDate: string | null;
  history: HistoryEntry[];
  mobility: MobilityEntry[];
  walks: WalkEntry[];
  weighins: WeighIn[];
};

export function historyJson(snapshot: Omit<ExportSnapshot, "exportedAt">): string {
  const full: ExportSnapshot = { exportedAt: new Date().toISOString(), ...snapshot };
  return JSON.stringify(full, null, 2);
}

// ---- daily opener splash (prototype's opener()/showOpener(), spec/prototype.html:1424-1464) ----
// A once-a-day date key, local time — matches the prototype's dayKey().
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const OWN_LINES: [string, string][] = [
  ["Show up.", "It adds up."],
  ["Today is a measurement.", "Not a test."],
  ["Same weight, better form,", "is still progress."],
  ["Consistency first.", "Load second."],
  ["Finishing beats", "doing it perfectly."],
  ["Nobody in here is", "thinking about you."],
];

export type OpenerCopy = { big: string; sub: string };

export function openerCopy(params: {
  history: HistoryEntry[];
  streak: number;
  session: number;
  block: number;
  blockSessions: number;
  lastDate: string | null;
  paused: boolean;
  isPlanDay: boolean;
  mobility: MobilityEntry[];
  mobilitySetting: Settings["mobility"];
  name: string;
  recoveryAdjustedAt?: string | null;
}): OpenerCopy {
  const { history, streak, session, block, blockSessions, lastDate, paused, isPlanDay, mobility, mobilitySetting, name, recoveryAdjustedAt } =
    params;
  const done = history.length;
  const nt = nextTrainingDay();
  const days = daysPer();
  const inWeek = session % days;
  if (!done) return { big: "Everyone starts here.", sub: name ? `Morning, ${name}. Session one is waiting.` : "Session one is waiting." };
  if (isComeback(history, lastDate, paused, recoveryAdjustedAt ?? null)) return { big: "Been a minute.", sub: "Pick it up exactly where you left it." };
  if (session >= blockSessions) return { big: `Block ${block} done.`, sub: `${blockSessions} sessions. Most people never get past three.` };
  if (trainedToday(history)) return { big: "Done for today.", sub: `See you ${nt.name}.` };
  const nextStreakTier = [3, 5, 10, 20, 50].find((v) => streak === v - 1);
  if (nextStreakTier) return { big: `One more and it's ${nextStreakTier}.`, sub: `${streak} in a row right now.` };
  const nextSessTier = [5, 10, 25, 50, 100].find((v) => done === v - 1);
  if (nextSessTier) return { big: `One more and it's ${nextSessTier}.`, sub: `${done} sessions logged.` };
  if (streak >= 3) return { big: `${streak} in a row.`, sub: "Keep it boring and it keeps working." };
  if (!isPlanDay && mobilityDue(mobility, mobilitySetting)) return { big: "Nothing today.", sub: "That's the plan. Muscle is built between sessions." };
  if (!isPlanDay) return { big: "Rest day.", sub: `Next one is ${nt.name}. A walk still counts.` };
  if (inWeek === 0) return { big: "First one of the week.", sub: "The hardest one to start is this one." };
  if (inWeek === days - 1) return { big: `Last of the ${days}.`, sub: "Then the week's done." };
  if (done < 6) return { big: "You're up.", sub: `Session ${session + 1}. It gets familiar fast.` };
  const own = OWN_LINES[(done + new Date().getDate()) % OWN_LINES.length];
  return { big: own[0], sub: own[1] };
}

// ---- weekly recap splash (prototype's weekRecap()/showWeekRecap(), spec/prototype.html:2319-2344) ----
export type WeekRecap = {
  start: number;
  sessions: number;
  target: number;
  mobility: number;
  walks: number;
  walkMin: number;
  activeDays: number;
  moved: number;
  ups: string[];
  avg: number | null;
  topTag: string | undefined;
  minutes: number;
};

export function weekRecap(
  history: HistoryEntry[],
  mobility: MobilityEntry[],
  walks: WalkEntry[],
  offsetWeeks: number
): WeekRecap {
  const wk = weekKey(new Date()) - offsetWeeks * 7 * 86400000;
  const end = wk + 7 * 86400000;
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= wk && t < end;
  };
  const sess = history.filter((h) => inRange(h.date));
  const mob = mobility.filter((m) => inRange(m.date));
  const wks = walks.filter((w) => inRange(w.date));
  let moved = 0;
  const ups: string[] = [];
  sess.forEach((h) =>
    Object.keys(h.moves).forEach((n) => {
      const m = h.moves[n];
      if (m.type !== "weight") return;
      const vals = m.setW && m.setW.length ? m.setW : [m.w];
      vals.forEach((v) => {
        moved += (m.reps || 10) * (Number(v) || 0);
      });
      const prev = prevFor(n, h.block, h.idx, history);
      if (prev && prev.w && m.w && Number(m.w) > Number(prev.w)) {
        ups.push(`${n} +${Math.round((Number(m.w) - Number(prev.w)) * 10) / 10}`);
      }
    })
  );
  const ratings = sess.filter((h) => h.rating).map((h) => h.rating as number);
  const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const tagCounts: Record<string, number> = {};
  sess.forEach((h) => (h.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const topTag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0];
  const minutes = sess.reduce((a, h) => a + (h.minutes || 0), 0);
  const days = new Set<string>();
  [sess, mob, wks].forEach((arr) => arr.forEach((x) => days.add(new Date(x.date).toDateString())));
  return {
    start: wk,
    sessions: sess.length,
    target: daysPer(),
    mobility: mob.length,
    walks: wks.length,
    walkMin: wks.reduce((a, w) => a + (w.minutes || 0), 0),
    activeDays: days.size,
    moved: Math.round(moved),
    ups,
    avg,
    topTag,
    minutes,
  };
}

// Reuses weekRecap()'s exact math and shape (so RecapCard can render it unmodified)
// for the "block finished" milestone, scoped to one block's sessions instead of a
// calendar week. Mobility/walks aren't tied to a block — they're logged independently
// of block/session position (see commitMobility's comment in lib/appState.tsx) — so
// those stay at 0 here rather than guessing an attribution.
export function blockRecap(history: HistoryEntry[], block: number, blockSessions: number): WeekRecap {
  const sess = history.filter((h) => h.block === block);
  let moved = 0;
  const ups: string[] = [];
  sess.forEach((h) =>
    Object.keys(h.moves).forEach((n) => {
      const m = h.moves[n];
      if (m.type !== "weight") return;
      const vals = m.setW && m.setW.length ? m.setW : [m.w];
      vals.forEach((v) => {
        moved += (m.reps || 10) * (Number(v) || 0);
      });
      const prev = prevFor(n, h.block, h.idx, history);
      if (prev && prev.w && m.w && Number(m.w) > Number(prev.w)) {
        ups.push(`${n} +${Math.round((Number(m.w) - Number(prev.w)) * 10) / 10}`);
      }
    })
  );
  const ratings = sess.filter((h) => h.rating).map((h) => h.rating as number);
  const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const tagCounts: Record<string, number> = {};
  sess.forEach((h) => (h.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const topTag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0];
  const minutes = sess.reduce((a, h) => a + (h.minutes || 0), 0);
  return {
    start: sess.length ? new Date(sess[0].date).getTime() : Date.now(),
    sessions: sess.length,
    target: blockSessions,
    mobility: 0,
    walks: 0,
    walkMin: 0,
    activeDays: sess.length,
    moved: Math.round(moved),
    ups,
    avg,
    topTag,
    minutes,
  };
}

// ---- tag counts (prototype's progTags, spec/prototype.html:2830-2832) — every
// session-level tag ("How was it?") and every movement-level tag (mtags) across all
// history, same counting rule for both: a tap counts exactly like a written note.
// Sorted by count descending, matching the prototype's badge order.
export type TagCount = { tag: string; count: number };
export function tagCounts(history: HistoryEntry[]): TagCount[] {
  const tc: Record<string, number> = {};
  history.forEach((h) => {
    (h.tags || []).forEach((t) => (tc[t] = (tc[t] || 0) + 1));
    Object.keys(h.moves).forEach((n) => (h.moves[n].mtags || []).forEach((t) => (tc[t] = (tc[t] || 0) + 1)));
  });
  return Object.keys(tc)
    .sort((a, b) => tc[b] - tc[a])
    .map((tag) => ({ tag, count: tc[tag] }));
}

// ---- milestones (prototype's ms/tier(), spec/prototype.html:2797-2820) — tiered so
// they never run out; `on` is a plain cur>=at check, re-evaluated fresh every call, not
// a stored "earned" flag. One prototype tier is deliberately not ported: progress
// photos. There's no photo capture/upload feature anywhere in this app to source a
// real photoCount from, and this port is existing-data-only — see CLAUDE.md/the task
// that added this function.
export type Milestone = { t: string; on: boolean; at: number; cur: number; label: string };

function tier(vals: number[], fmt: (v: number) => string, label: string, cur: number): Milestone[] {
  return vals.map((v) => ({ t: fmt(v), on: cur >= v, at: v, cur, label }));
}

export function milestoneList(
  history: HistoryEntry[],
  mobility: MobilityEntry[],
  walks: WalkEntry[],
  streak: number,
  block: number,
  units: Profile["units"]
): Milestone[] {
  const total = history.length;
  const d = liftDeltas(history);
  const names = Object.keys(d);
  const prs = names.filter((n) => d[n].delta > 0).length;
  const weekSet = new Set(history.map((h) => weekKey(h.date)));
  const moved = historyMovedTotal(history);
  const walkMin = walks.reduce((a, w) => a + (w.minutes || 0), 0);
  const ratedCount = history.filter((h) => h.rating).length;
  const movedTarget =
    units === "metric"
      ? [1000, 5000, 10000, 25000, 50000, 100000, 250000]
      : [2500, 10000, 25000, 50000, 100000, 250000, 500000];
  const u = unit(units);

  return [
    { t: "First session", on: total >= 1, at: 1, cur: total, label: "sessions" },
    ...tier([5, 10, 25, 50, 100, 200, 365], (v) => `${v} sessions`, "sessions", total),
    {
      t: "First full week",
      on: weekSet.size >= 1 && history.some((h) => (h.idx + 1) % daysPer() === 0),
      at: 1,
      cur: weekSet.size,
      label: "weeks",
    },
    ...tier([4, 8, 12, 26, 52], (v) => `${v} weeks training`, "weeks", weekSet.size),
    ...tier([3, 5, 10, 20, 50], (v) => `${v} in a row`, "streak", streak || 0),
    { t: "A lift went up", on: prs >= 1, at: 1, cur: prs, label: "lifts up" },
    ...tier([3, 5, 10], (v) => `${v} lifts improved`, "lifts up", prs),
    ...tier(movedTarget, (v) => `${v >= 1000 ? v / 1000 + "k" : v} ${u} moved`, "moved", Math.round(moved)),
    ...tier([1, 5, 10, 25], (v) => (v === 1 ? "First mobility day" : `${v} mobility days`), "mobility", mobility.length),
    ...tier([1, 10, 25, 50, 100], (v) => (v === 1 ? "First walk logged" : `${v} walks or runs`), "walks", walks.length),
    ...tier([60, 300, 1000, 3000], (v) => `${v} minutes moving`, "walkmin", walkMin),
    ...tier([5, 20], (v) => `${v} sessions rated`, "rated", ratedCount),
    ...tier([1, 2, 3, 4], (v) => `Block ${v} done`, "blocks", block - 1),
  ];
}
