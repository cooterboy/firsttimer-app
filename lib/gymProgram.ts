// Ported verbatim from spec/prototype.html — GYM.A movements and the
// gym version of FIRST_DAY. This is the fixed first session shown before
// anyone has trained: block 1, session 1, "A" day, 2 sets (the ramp-in week).
// The full program engine (all letters, blocks, swaps, pain substitutions)
// is a later build step — this is just enough to render Today.

export type Movement = {
  name: string;
  cue: string;
  spec: string;
};

export const sessionOneMovements: Movement[] = [
  { name: "Leg press", cue: "Feet shoulder-width. Don't lock your knees at the top.", spec: "2 × 12" },
  { name: "Chest press machine", cue: "Handles at chest height. Push, don't bounce.", spec: "2 × 12" },
  { name: "Seated row", cue: "Pull to your belly button. Shoulders down.", spec: "2 × 12" },
  { name: "DB Romanian deadlift", cue: "Push your hips back. Soft knees. Feel it in your hamstrings.", spec: "2 × 12" },
  { name: "Plank", cue: "Squeeze everything. Don't let your hips sag.", spec: "2 × 20 sec" },
];

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
