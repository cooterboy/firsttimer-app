// The certified trainer who wrote and signs off on the gym program — shown on
// screens/TrainerScreen.tsx, reached from the Programs tab.
//
// PLACEHOLDER until the real trainer's details arrive. To swap them in, edit the
// values below and set `placeholder: false` — that also removes the on-screen
// "placeholder" notice. Nothing else needs to change. Per CLAUDE.md, placeholder
// content is labelled as such on screen rather than passed off as real.

export type Trainer = {
  placeholder: boolean;
  name: string;
  credentials: string[];
  bio: string;
  // url stays null until there's a real profile to link to; the screen then shows
  // the handle as not connected yet instead of opening a made-up address.
  social: { label: string; handle: string; url: string | null } | null;
};

export const TRAINER: Trainer = {
  placeholder: true,
  name: "Coach Name",
  credentials: ["Certification — placeholder", "Years coaching — placeholder"],
  bio: "A certified trainer who writes programs for people who've never trained. The full bio goes here.",
  social: { label: "Instagram", handle: "@coachname", url: null },
};
