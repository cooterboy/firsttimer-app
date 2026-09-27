// Ported verbatim from spec/prototype.html: the GYM movement bank (letters A/B/C),
// the rep-style presets, and the pure functions that build a session from a block
// and session index. Home/garage/hotel/outdoor variants exist in the prototype too
// (HOME_DB, HOME_NONE) but aren't ported yet — v1's default profile is "gym".

export type MovementType = "weight" | "reps" | "time";

export type MovementVariant = {
  n: string;
  cue: string;
  type?: MovementType;
  perSide?: boolean;
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
};

export const LETTERS = ["A", "B", "C"] as const;
export type Letter = (typeof LETTERS)[number];

export const BLOCK_SESSIONS = 24;

export const GYM: Record<Letter, BaseMovement[]> = {
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

export const MUSCLES: Record<string, string> = {
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

export const REP_STYLES = {
  strength: { l: "Heavier", sub: "6–8 reps. Fewer reps, more weight, longer rests.", w: [8, 6], r: [10, 8], t: 1.0, rest: 1.25 },
  balanced: { l: "Balanced", sub: "8–12 reps. What the trainer wrote. Best default for a first block.", w: [10, 8], r: [12, 10], t: 1.0, rest: 1 },
  endurance: { l: "Lighter", sub: "12–15 reps. Lighter weight, more reps, shorter rests.", w: [15, 12], r: [15, 15], t: 1.3, rest: 0.8 },
} as const;
export type RepStyleKey = keyof typeof REP_STYLES;

export const firstDayGym: { title: string; body: string }[] = [
  {
    title: "What to wear",
    body: "Anything you can move in. Trainers, not slides. Nobody is looking at your clothes, and that fear is the most common one there is.",
  },
  {
    title: "What to bring",
    body: "Water, your phone, and a towel if the gym asks for one. No belt, no gloves, no pre-workout.",
  },
  {
    title: "When to go",
    body: "Mid-morning and early afternoon are emptiest. If 5pm is your only option, go at 5pm. A busy gym just means more swaps, and the app has them.",
  },
  {
    title: "Walking in",
    body: "Ask at the desk where the changing rooms are, then find the first machine on your list. If you cannot find it, ask a staff member. It is the most normal question they get all day.",
  },
  {
    title: "Using a machine",
    body: "Adjust the seat before you load it. If someone is on it, tap Machine taken and do the swap instead. Asking how many sets they have left is completely normal.",
  },
  {
    title: "When you are done",
    body: "Wipe the machine down and put the dumbbells back. That is the whole etiquette.",
  },
];

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
export function weeksPerBlock(): number {
  return Math.ceil(BLOCK_SESSIONS / daysPer());
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

// prototype's specFor(): the "3 × 10" style label
export function specFor(
  mv: { type: MovementType; n: string; perSide?: boolean },
  sets: number,
  block: number,
  reps: RepStyleKey
): string {
  const st = repStyle(reps);
  const i = block >= 2 ? 1 : 0;
  if (mv.type === "time") {
    let s = /carry/i.test(mv.n) ? (sets === 2 ? 30 : 40) : sets === 2 ? 20 : 30;
    if (block >= 2) s += 10;
    s = Math.round((s * st.t) / 5) * 5;
    return `${sets} × ${s} sec`;
  }
  let r: number = mv.type === "reps" ? st.r[i] : st.w[i];
  if (/dead bug|bird dog/i.test(mv.n)) r = Math.min(r, 10);
  return `${sets} × ${r}${mv.perSide ? "/side" : ""}`;
}

export type SessionMovement = BaseMovement & { sets: number; spec: string; swapped: string; orig: BaseMovement };

export type BuiltSession = {
  block: number;
  idx: number;
  letter: Letter;
  week: number;
  sets: number;
  moves: SessionMovement[];
};

const PAIN_LABEL: Record<string, string> = { back: "lower back" };

// prototype's buildSession(), including the pain-substitution step.
export function buildSession(
  block: number,
  idx: number,
  lengthMin: number,
  reps: RepStyleKey,
  pain: string[] = []
): BuiltSession {
  const letter = LETTERS[idx % 3];
  const week = weekOf(idx);
  const sets = setsFor(block, week, lengthMin);
  const moves: SessionMovement[] = GYM[letter].map((m) => {
    let mv: BaseMovement = { ...m };
    let swappedFor: string | null = null;
    pain.forEach((p) => {
      if (!swappedFor && m.pain && m.pain[p]) {
        const alt = m.pain[p];
        mv = { ...m, ...alt, type: alt.type || m.type };
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
  return { block, idx, letter, week, sets, moves };
}
