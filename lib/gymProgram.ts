// Ported verbatim from spec/prototype.html: the GYM movement bank (sessions A/B/C),
// the rep-style presets, and the pure functions that build a session from a block
// and session index. Program content itself now comes from Supabase (migrations
// 013/014, fetched in lib/sync.ts); GYM and MUSCLES here are only the offline
// fallback for a fresh install with no cache and no network — see GYM_PROGRAM.

export type MovementType = "weight" | "reps" | "time";

export type MovementVariant = {
  n: string;
  cue: string;
  type?: MovementType;
  perSide?: boolean;
  why?: string;
};

// Per-slot prescription from template_movements.params. Every field is optional,
// and an absent field means the prototype's name-based rule applies — so the gym
// program, whose params are all empty, behaves exactly as the prototype does.
// Only slots carry params; a swapped-in alternative always uses the name rules.
export type MovementParams = {
  equipment?: "dumbbell" | "machine"; // which first-weight hint startHint() gives
  start_lb?: number; // starting dumbbell weight, in lb
  single?: boolean; // one dumbbell rather than a pair
  long_hold?: boolean; // timed holds start longer, as carries do
  rep_cap?: number; // never prescribe more reps than this
};

export type BaseMovement = {
  n: string;
  cue: string;
  type: MovementType;
  rest: number;
  perSide?: boolean;
  sub?: MovementVariant;
  easier?: MovementVariant;
  pain?: Record<string, MovementVariant>;
  why?: string;
  params?: MovementParams;
};

// One session in a program's rotation ("Session A"). `code` is what history
// records, so it's stable; the rotation order is the array order.
export type SessionTemplate = { code: string; label: string; moves: BaseMovement[] };

// A resolved plan — a `programs` row with its sessions and movements.
export type Program = {
  id: string;
  category: string;
  whereKeys: string[];
  name: string;
  blockSessions: number;
  templates: SessionTemplate[];
};

const GYM: Record<"A" | "B" | "C", BaseMovement[]> = {
  A: [
    {
      n: "Leg press",
      cue: "Feet shoulder-width. Don't lock your knees at the top.",
      type: "weight",
      rest: 90,
      sub: { n: "Goblet squat", cue: "Hold one dumbbell at your chest. Sit down between your feet." },
      easier: { n: "Box squat", cue: "Sit back to a bench, stand up. No weight.", type: "reps" },
      pain: { knees: { n: "Leg curl", cue: "Slow on the way back." } },
    },
    {
      n: "Chest press machine",
      cue: "Handles at chest height. Push, don't bounce.",
      type: "weight",
      rest: 60,
      sub: { n: "DB bench press", cue: "Dumbbells over your chest. Lower slow, press up." },
      easier: { n: "Incline push-up", cue: "Hands on a bench. Body straight.", type: "reps" },
      pain: { shoulders: { n: "Neutral-grip floor press", cue: "Palms facing each other. Elbows stop at the floor." } },
    },
    {
      n: "Seated row",
      cue: "Pull to your belly button. Shoulders down.",
      type: "weight",
      rest: 60,
      sub: { n: "One-arm DB row", cue: "Hand on a bench. Pull to your hip." },
      easier: { n: "Band row", cue: "Band around a post. Squeeze your shoulder blades.", type: "reps" },
      pain: { back: { n: "Chest-supported row", cue: "Chest stays on the pad the whole time." } },
    },
    {
      n: "DB Romanian deadlift",
      cue: "Push your hips back. Soft knees. Feel it in your hamstrings.",
      type: "weight",
      rest: 90,
      sub: { n: "Leg curl", cue: "Slow on the way back." },
      easier: { n: "Hip hinge, no weight", cue: "Hands on hips, push them back to the wall behind you.", type: "reps" },
      pain: { back: { n: "Leg curl", cue: "Slow on the way back." } },
    },
    {
      n: "Plank",
      cue: "Squeeze everything. Don't let your hips sag.",
      type: "time",
      rest: 45,
      easier: { n: "Knee plank", cue: "Knees down, hips in line.", type: "time" },
      pain: { shoulders: { n: "Dead bug", cue: "Lower back stays flat on the floor.", type: "reps" } },
    },
  ],
  B: [
    {
      n: "Goblet squat",
      cue: "Hold one dumbbell at your chest. Sit down between your feet.",
      type: "weight",
      rest: 90,
      sub: { n: "Leg press", cue: "Feet shoulder-width. Don't lock your knees at the top." },
      easier: { n: "Box squat", cue: "Sit back to a bench, stand up. No weight.", type: "reps" },
      pain: { knees: { n: "Leg press, short range", cue: "Stop before your knees pass 90°." } },
    },
    {
      n: "Lat pulldown",
      cue: "Pull the bar to your collarbone, not behind your head.",
      type: "weight",
      rest: 60,
      sub: { n: "Assisted pull-up", cue: "Knees on the pad. Pull your chest to the bar." },
      easier: { n: "Band pulldown", cue: "Band over a bar. Pull to your chest.", type: "reps" },
      pain: { shoulders: { n: "Neutral-grip pulldown", cue: "Palms facing each other. Elbows to your ribs." } },
    },
    {
      n: "DB shoulder press",
      cue: "Press straight up. Ribs down.",
      type: "weight",
      rest: 60,
      sub: { n: "Machine shoulder press", cue: "Seat so the handles start at ear height." },
      easier: { n: "Seated DB press, light", cue: "Half the weight. Full range.", type: "weight" },
      pain: { shoulders: { n: "Incline DB press", cue: "Bench at 30°. Elbows slightly tucked." } },
    },
    {
      n: "Leg curl",
      cue: "Slow on the way back.",
      type: "weight",
      rest: 60,
      sub: { n: "DB Romanian deadlift", cue: "Push your hips back. Soft knees." },
      easier: { n: "Glute bridge", cue: "Feet flat, drive your hips up, squeeze.", type: "reps" },
      pain: { knees: { n: "Glute bridge", cue: "Feet flat, drive your hips up, squeeze.", type: "reps" } },
    },
    {
      n: "Dead bug",
      cue: "Lower back stays flat on the floor.",
      type: "reps",
      rest: 45,
      easier: { n: "Dead bug, arms only", cue: "Legs stay up. Just the arms move.", type: "reps" },
      pain: { back: { n: "Bird dog", cue: "Opposite arm and leg. Hold two seconds.", type: "reps" } },
    },
  ],
  C: [
    {
      n: "Hip thrust",
      cue: "Shoulders on the bench. Squeeze at the top.",
      type: "weight",
      rest: 90,
      sub: { n: "Glute bridge", cue: "Feet flat, drive your hips up, squeeze." },
      easier: { n: "Glute bridge", cue: "Feet flat, drive your hips up, squeeze.", type: "reps" },
      pain: { back: { n: "Glute bridge", cue: "Feet flat, drive your hips up, squeeze.", type: "reps" } },
    },
    {
      n: "Incline DB press",
      cue: "Bench at 30°. Elbows slightly tucked.",
      type: "weight",
      rest: 60,
      sub: { n: "Chest press machine", cue: "Handles at chest height. Push, don't bounce." },
      easier: { n: "Incline push-up", cue: "Hands on a bench. Body straight.", type: "reps" },
      pain: { shoulders: { n: "Neutral-grip floor press", cue: "Palms facing each other. Elbows stop at the floor." } },
    },
    {
      n: "Chest-supported row",
      cue: "Chest stays on the pad the whole time.",
      type: "weight",
      rest: 60,
      sub: { n: "Seated row", cue: "Pull to your belly button. Shoulders down." },
      easier: { n: "Band row", cue: "Band around a post. Squeeze your shoulder blades.", type: "reps" },
      pain: { back: { n: "Seated row", cue: "Pull to your belly button. Shoulders down." } },
    },
    {
      n: "Split squat",
      cue: "Back knee toward the floor. Front shin upright.",
      type: "weight",
      rest: 60,
      perSide: true,
      sub: { n: "Leg press", cue: "Feet shoulder-width. Don't lock your knees at the top.", perSide: false },
      easier: { n: "Step-up", cue: "Low box. Drive through the front heel.", type: "reps", perSide: true },
      pain: { knees: { n: "Leg press, short range", cue: "Stop before your knees pass 90°.", perSide: false } },
    },
    {
      n: "Farmer carry",
      cue: "Heavy dumbbells, walk tall, don't lean.",
      type: "time",
      rest: 60,
      easier: { n: "Farmer carry, light", cue: "Lighter dumbbells. Same walk.", type: "time" },
      pain: { back: { n: "Suitcase carry", cue: "One dumbbell. Don't lean away from it.", type: "time" } },
    },
  ],
};

const MUSCLES: Record<string, string> = {
  "Leg press": "Quads and glutes. The safest way to load your legs on day one: the machine holds you, you push.",
  "Chest press machine": "Chest, front of shoulders, triceps. A fixed path so you learn the push before dumbbells.",
  "Seated row": "Upper back and biceps. Balances the pressing, and it's what keeps your shoulders back at a desk.",
  "DB Romanian deadlift": "Hamstrings and glutes. The hip hinge: the single most useful pattern in the gym.",
  Plank: "Everything between your ribs and hips. Teaches you to brace, which every other lift needs.",
  "Goblet squat": "Quads, glutes, core. Holding the weight in front keeps you upright and makes the squat easy to learn.",
  "Lat pulldown": "Lats and biceps. The pull-up, with as much help as you need.",
  "DB shoulder press": "Shoulders and triceps. Pressing overhead with dumbbells lets each arm find its own path.",
  "Leg curl": "Hamstrings. Isolates the back of the leg so the hinge gets stronger.",
  "Dead bug": "Deep core. Looks easy, isn't. Keeps your lower back flat under load.",
  "Hip thrust": "Glutes. The strongest muscle in your body, trained directly.",
  "Incline DB press": "Upper chest and shoulders. The angle hits what the flat press misses.",
  "Chest-supported row": "Upper back. The pad takes your lower back out of it, so you can pull hard safely.",
  "Split squat": "Quads and glutes, one leg at a time. Fixes the side that's been coasting.",
  "Farmer carry": "Grip, core, upper back. Walking with heavy things is the oldest exercise there is.",
};

// The offline fallback: the same content migration 014 put in the database,
// shaped the way lib/sync.ts shapes fetched content — including `why` on every
// movement and alternative whose exercise has one, as exercises.why does.
function withWhy<T extends { n: string; why?: string }>(v: T): T {
  return MUSCLES[v.n] ? { ...v, why: MUSCLES[v.n] } : v;
}
export const GYM_PROGRAM: Program = {
  id: "gym",
  category: "gym",
  whereKeys: ["gym", "garage"],
  name: "Gym",
  blockSessions: 24,
  templates: (["A", "B", "C"] as const).map((code) => ({
    code,
    label: `Session ${code}`,
    moves: GYM[code].map((m) => ({
      ...withWhy(m),
      sub: m.sub && withWhy(m.sub),
      easier: m.easier && withWhy(m.easier),
      pain: m.pain && Object.fromEntries(Object.entries(m.pain).map(([k, v]) => [k, withWhy(v)])),
    })),
  })),
};

export const REP_STYLES = {
  strength: { l: "Heavier", sub: "6–8 reps. Fewer reps, more weight, longer rests.", w: [8, 6], r: [10, 8], t: 1.0, rest: 1.25 },
  balanced: { l: "Balanced", sub: "8–12 reps. What the trainer wrote. Best default for a first block.", w: [10, 8], r: [12, 10], t: 1.0, rest: 1 },
  endurance: { l: "Lighter", sub: "12–15 reps. Lighter weight, more reps, shorter rests.", w: [15, 12], r: [15, 15], t: 1.3, rest: 0.8 },
} as const;
export type RepStyleKey = keyof typeof REP_STYLES;

// Ported from the prototype's FIRST_DAY object (spec/prototype.html:2231) — one guide
// per `where`, keyed to match lib/types.ts's Where union exactly.
export const FIRST_DAY: Record<string, { title: string; body: string }[]> = {
  gym: [
    { title: "What to wear", body: "Anything you can move in. Trainers, not slides. Nobody is looking at your clothes, and that fear is the most common one there is." },
    { title: "What to bring", body: "Water, your phone, and a towel if the gym asks for one. No belt, no gloves, no pre-workout." },
    { title: "When to go", body: "Mid-morning and early afternoon are emptiest. If 5pm is your only option, go at 5pm. A busy gym just means more swaps, and the app has them." },
    { title: "Walking in", body: "Ask at the desk where the changing rooms are, then find the first machine on your list. If you cannot find it, ask a staff member. It is the most normal question they get all day." },
    { title: "Using a machine", body: "Adjust the seat before you load it. If someone is on it, tap Machine taken and do the swap instead. Asking how many sets they have left is completely normal." },
    { title: "When you are done", body: "Wipe the machine down and put the dumbbells back. That is the whole etiquette." },
  ],
  garage: [
    { title: "Set up first", body: "Clear enough space to lie down with your arms out, and put the dumbbells you need within reach before you start." },
    { title: "What to wear", body: "Anything you can move in. Shoes on for anything standing." },
    { title: "Safety", body: "Train where someone could hear you. Do not press anything overhead you could not set down safely on your own." },
    { title: "When you are done", body: "Put things back where they were. It lowers the barrier for the next session." },
  ],
  home_db: [
    { title: "Set up first", body: "Clear enough space to lie down with your arms out, and get your dumbbells within reach." },
    { title: "What you need", body: "Two dumbbells and something to sit or lie on. A sturdy chair does everything a bench does here." },
    { title: "Not enough weight?", body: "Do more reps and slow them down. A lighter weight moved properly beats a heavy one thrown." },
    { title: "Noise", body: "If someone lives below you, put a towel down and control the lowering. That is better form anyway." },
  ],
  hotel: [
    { title: "Set up first", body: "Clear a space by the bed. Most hotel gyms have dumbbells and a bench, which is all this program needs." },
    { title: "If the gym is busy", body: "One person and two dumbbells is enough. Take them to your room." },
    { title: "Travel weeks", body: "A shorter session beats a skipped one. Cut to two sets and keep the movements." },
  ],
  home_none: [
    { title: "Set up first", body: "Clear enough space to lie down with your arms out. That is the entire setup." },
    { title: "What to wear", body: "Anything. Shoes optional on the floor, on for anything standing." },
    { title: "Harder than it looks", body: "Bodyweight work is about control, not speed. Slow the lowering half of every rep and it is plenty hard." },
    { title: "If something is too hard", body: "Every movement has an easier version one tap away. Using it is the program working, not cheating." },
  ],
  outside: [
    { title: "Where to go", body: "A bench, a step and a patch of grass covers everything in this session." },
    { title: "What to bring", body: "Water, and a towel or mat for floor work." },
    { title: "Weather", body: "Cold means a longer warm-up. Wet grass means swapping floor work for standing movements." },
    { title: "Feeling watched", body: "Nobody at a park is watching. The ones who glance over are usually the people who have been thinking about starting too." },
  ],
};
export const firstDayGym = FIRST_DAY.gym;

// Only the strength engine exists, so only gym-category plans can run — a hyrox
// or marathon plan needs its own engine before it's selectable. A plan also has
// to be complete: at least one session, every session with at least one
// movement, and only the movement kinds this engine understands.
const RUNNABLE_KINDS: MovementType[] = ["weight", "reps", "time"];
export function isRunnable(p: Program): boolean {
  return (
    p.category === "gym" &&
    p.templates.length > 0 &&
    p.templates.every(
      (t) =>
        t.moves.length > 0 &&
        t.moves.every(
          (m) =>
            RUNNABLE_KINDS.includes(m.type) &&
            [m.sub, m.easier, ...Object.values(m.pain || {})].every((v) => !v || !v.type || RUNNABLE_KINDS.includes(v.type))
        )
    )
  );
}

// The plan for where someone trains (migration 013): the first runnable plan
// (programs arrive sorted by sort_order, live only) whose where_keys include
// their `where`, else the gym plan — the prototype's `SETS[where] || GYM`.
export function selectProgram(programs: Program[], where: string): Program {
  const runnable = programs.filter(isRunnable);
  return (
    runnable.find((p) => p.whereKeys.includes(where)) ||
    runnable.find((p) => p.whereKeys.includes("gym")) ||
    GYM_PROGRAM
  );
}

export function unit(units: "imperial" | "metric") {
  return units === "metric" ? "kg" : "lb";
}
export function step(units: "imperial" | "metric") {
  return units === "metric" ? 2.5 : 5;
}

export function daysPer(): number {
  return 3; // v1 default: no planDays override yet
}
export function weekOf(idx: number): number {
  return Math.floor(idx / daysPer()) + 1;
}
export function weeksPerBlock(blockSessions: number): number {
  return Math.ceil(blockSessions / daysPer());
}

function repStyle(reps: RepStyleKey) {
  return REP_STYLES[reps] || REP_STYLES.balanced;
}

// prototype's repStyle().rest: Heavier rests longer, Lighter rests shorter.
export function restMultiplier(reps: RepStyleKey): number {
  return repStyle(reps).rest;
}

// prototype's setsFor(): how many sets a given week runs
export function setsFor(block: number, week: number, lengthMin: number): number {
  const setTarget = lengthMin <= 30 ? 2 : lengthMin >= 60 ? 4 : 3;
  return block === 1 && week === 1 ? Math.max(2, setTarget - 1) : setTarget;
}

// prototype's specFor(): the "3 × 10" style label. params (see MovementParams)
// override the prototype's name-based rules where set.
export function specFor(
  mv: { type: MovementType; n: string; perSide?: boolean; params?: MovementParams },
  sets: number,
  block: number,
  reps: RepStyleKey
): string {
  const st = repStyle(reps);
  const i = block >= 2 ? 1 : 0;
  const p = mv.params || {};
  if (mv.type === "time") {
    const longHold = p.long_hold ?? /carry/i.test(mv.n);
    let s = longHold ? (sets === 2 ? 30 : 40) : sets === 2 ? 20 : 30;
    if (block >= 2) s += 10;
    s = Math.round((s * st.t) / 5) * 5;
    return `${sets} × ${s} sec`;
  }
  let r: number = mv.type === "reps" ? st.r[i] : st.w[i];
  const repCap = p.rep_cap ?? (/dead bug|bird dog/i.test(mv.n) ? 10 : null);
  if (repCap != null) r = Math.min(r, repCap);
  return `${sets} × ${r}${mv.perSide ? "/side" : ""}`;
}

export type SessionMovement = BaseMovement & { sets: number; spec: string; swapped: string; orig: BaseMovement };

export type BuiltSession = {
  block: number;
  idx: number;
  letter: string; // the session template's code, e.g. "A"
  week: number;
  sets: number;
  moves: SessionMovement[];
};

const PAIN_LABEL: Record<string, string> = { back: "lower back", other: "joints" };

// prototype's buildSession(), including the pain-substitution step. `program` is
// the plan to build from — normally fetched from Supabase (AppState.program),
// falling back to GYM_PROGRAM only if that fetch and its local cache both come
// up empty. Sessions rotate through the program's templates in order, so the
// rotation length is however many templates the program has (A/B/C for gym).
export function buildSession(
  program: Program,
  block: number,
  idx: number,
  lengthMin: number,
  reps: RepStyleKey,
  pain: string[] = []
): BuiltSession {
  const template = program.templates[idx % program.templates.length];
  const week = weekOf(idx);
  const sets = setsFor(block, week, lengthMin);
  const moves: SessionMovement[] = template.moves.map((m) => {
    let mv: BaseMovement = { ...m };
    let swappedFor: string | null = null;
    pain.forEach((p) => {
      if (!swappedFor && m.pain && m.pain[p]) {
        const alt = m.pain[p];
        // params belong to the slot's own exercise, not the one swapped in.
        mv = { ...m, ...alt, type: alt.type || m.type, params: undefined };
        swappedFor = p;
      }
    });
    return {
      ...mv,
      sets,
      spec: specFor(mv, sets, block, reps),
      swapped: swappedFor ? `Swapped for your ${PAIN_LABEL[swappedFor] || swappedFor}` : "",
      orig: m,
    };
  });
  return { block, idx, letter: template.code, week, sets, moves };
}
