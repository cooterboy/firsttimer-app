// Ported from spec/prototype.html's workout engine (openWorkout, advance/goMove,
// setFeedback, moveSummary, applySwap, logSession, finishCopy, coachRead, nextPreview).
// Functions here are pure — they take state as arguments instead of reading a global
// `state`/`wo`, since React state is owned by the screens that call these.

import {
  BuiltSession,
  BLOCK_SESSIONS,
  MovementVariant,
  buildSession as buildSessionData,
  daysPer,
  specFor,
  step,
  unit,
} from "./gymProgram";
import * as Crypto from "expo-crypto";
import { ActiveMove, ActiveWorkout, HistoryEntry, HistoryMove, Profile, Settings } from "./types";

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
export function buildSessionForProfile(block: number, idx: number, profile: Profile): BuiltSession {
  return buildSessionData(block, idx, profile.length, profile.reps, profile.pain);
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
export function prepareWorkoutMoves(built: BuiltSession, profile: Profile, settings: Settings, history: HistoryEntry[]): ActiveMove[] {
  const st = step(profile.units);
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
      setW.push(v);
    }
    return {
      n: m.n,
      cue: m.cue,
      type: m.type,
      spec: m.spec,
      sets: m.sets,
      rest: Math.round(m.rest || settings.restDefault),
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
      orig: m.orig,
    };
  });
  if (settings.warmup) moves.unshift(warmupMovement(profile));
  return moves;
}

export function newActiveWorkout(built: BuiltSession, profile: Profile, settings: Settings, history: HistoryEntry[]): ActiveWorkout {
  return {
    block: built.block,
    idx: built.idx,
    letter: built.letter,
    week: built.week,
    mi: 0,
    moves: prepareWorkoutMoves(built, profile, settings, history),
    activeMs: 0,
    segStart: Date.now(),
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
export function setFeedback(m: ActiveMove, i: number, block: number, idx: number, history: HistoryEntry[], profile: Profile): { kind: "up" | "down" | "same"; text: string } | null {
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
  const kg = profile.units === "metric";
  const u = unit(profile.units);
  if (/\bDB\b|dumbbell|goblet|farmer|suitcase|renegade|one-arm/i.test(n)) {
    const lb = /shoulder press|floor press|romanian|bent-over|one-arm row/i.test(n) ? 10 : /carry/i.test(n) ? 20 : 15;
    const v = kg ? Math.round(lb / 2.2046 / 2.5) * 2.5 : lb;
    const single = /goblet|one-arm|suitcase/i.test(n);
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

export function nextPreview(block: number, session: number, profile: Profile): { title: string; moves: string } {
  if (session >= BLOCK_SESSIONS) return { title: "Block done", moves: "The next block picks up where this one ended." };
  const s = buildSessionForProfile(block, session, profile);
  const nt = nextTrainingDay();
  return { title: `${nt.name} · Session ${session + 1} · ${s.letter}`, moves: s.moves.map((m) => m.n).join(" · ") };
}

export type FinishCopy = { big: string; line: string; wins: string[]; card: string; caption: string };

export function finishCopy(wo: ActiveWorkout, real: ActiveMove[], blockDone: boolean, milestone: boolean, history: HistoryEntry[], profile: Profile): FinishCopy {
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
    line = `${BLOCK_SESSIONS} sessions. Most people never get past three.`;
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
