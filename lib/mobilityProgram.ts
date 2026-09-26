// Ported verbatim from spec/prototype.html's MOBILITY array. Ten timed stretches,
// about twelve minutes, offered on a non-training day.

export type MobilityMove = {
  n: string;
  cue: string;
  sec: number;
  perSide?: boolean;
};

export const MOBILITY: MobilityMove[] = [
  { n: "Cat-cow", cue: "On hands and knees. Round your back up, then let it sag. Slow, with your breath.", sec: 60 },
  {
    n: "World's greatest stretch",
    cue: "Lunge, hand down inside the front foot, reach the other arm to the ceiling.",
    sec: 45,
    perSide: true,
  },
  {
    n: "Hip flexor stretch",
    cue: "Half-kneeling. Squeeze the back glute and shift forward. Stay tall.",
    sec: 45,
    perSide: true,
  },
  {
    n: "Figure-four",
    cue: "On your back, ankle on the opposite knee, pull the leg toward you.",
    sec: 45,
    perSide: true,
  },
  {
    n: "Hamstring stretch",
    cue: "One heel on a step. Hinge forward from the hips with a flat back.",
    sec: 45,
    perSide: true,
  },
  {
    n: "Thoracic rotation",
    cue: "Side-lying, knees stacked, open the top arm across to the other side.",
    sec: 45,
    perSide: true,
  },
  {
    n: "Doorway chest stretch",
    cue: "Forearm on the frame, elbow at shoulder height, step through.",
    sec: 45,
    perSide: true,
  },
  { n: "Calf stretch", cue: "Hands on a wall, one leg back, heel down.", sec: 40, perSide: true },
  { n: "Deep squat hold", cue: "Hold onto something. Sit as low as you can and breathe.", sec: 60 },
  { n: "Child's pose", cue: "Knees wide, arms long, forehead down. Breathe into your back.", sec: 60 },
];

// A single flat list of steps, splitting per-side moves into left/right (prototype's openMobility()).
export function mobilitySteps(): { n: string; cue: string; sec: number }[] {
  const steps: { n: string; cue: string; sec: number }[] = [];
  MOBILITY.forEach((m) => {
    if (m.perSide) {
      steps.push({ n: `${m.n} · left`, cue: m.cue, sec: m.sec });
      steps.push({ n: `${m.n} · right`, cue: m.cue, sec: m.sec });
    } else {
      steps.push({ n: m.n, cue: m.cue, sec: m.sec });
    }
  });
  return steps;
}

export function mobilityMinutes(): number {
  return Math.round(MOBILITY.reduce((a, m) => a + m.sec * (m.perSide ? 2 : 1), 0) / 60);
}
