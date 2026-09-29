// Ported from the prototype's FAQ array (spec/prototype.html:1053-1066). Two
// entries are dropped rather than adapted: the box-discount-code question and
// the friends/sharing question — both describe features cut from v1 (Shop,
// Friends), and an FAQ answering questions about a feature that doesn't exist
// yet would mislead rather than help. The account question is trimmed of its
// "Sign in with Apple or Google" clause for the same reason — not built yet.
export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: "Is the program safe for a complete beginner?",
    a: "It's written and signed off by a certified trainer for people who've never trained. Every movement has an easier version and a swap if it hurts. If you have a medical condition, check with a doctor first.",
  },
  {
    q: "What if I miss a session?",
    a: "Nothing happens. Open the app and the same session is waiting. The plan doesn't skip ahead and there's no penalty. Going away for a while? Pause the program under Training preferences.",
  },
  {
    q: "What's a mobility day?",
    a: "Ten timed stretches, about twelve minutes, on a day you don't lift. The app offers it once a week (you can make it every two weeks, or turn it off). It's the part of training most beginners skip and then wish they hadn't.",
  },
  {
    q: "Can I change the sets and reps?",
    a: "Yes, in the way that matters. Under Training preferences, session length sets how many sets (30 min is 2, 45 is 3, 60 is 4) and rep style sets the range: Heavier is 6–8, Balanced is 8–12 and is what the trainer wrote, Lighter is 12–15. The movements and the progression stay the trainer's. Mid-session, 'Short on time today' drops one set from whatever is left.",
  },
  {
    q: "Can I use a different weight for each set?",
    a: "Yes. Each set has its own box. Mark a set done and its weight carries into the next set, so you only change it when you go up or down.",
  },
  {
    q: "Can I switch from gym to home?",
    a: "Yes. Change 'Where you train' under Training preferences. Your next session uses the home movements. Weights logged on gym machines stay in your history.",
  },
  {
    q: "I stopped for a month. Do I start over?",
    a: "No. Open the app and it meets you where you are: your old numbers, a suggestion to go about 15% lighter for one session, and the option to pick up exactly where you left off or restart the block. Nothing expires and there's no streak to rebuild.",
  },
  {
    q: "Do I need an account?",
    a: "Yes: an email and a password. That's what keeps your sessions and weights when you change phones. Forgot the password? One tap emails a reset link.",
  },
  {
    q: "Who sees my weight and height?",
    a: "Only you. They're optional and they're never shown to brands, gyms, trainers, or friends.",
  },
];
