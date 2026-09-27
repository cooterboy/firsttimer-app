// Plain-language drafts, not attorney-reviewed. Adapted from spec/prototype.html's
// SUB.privacy/SUB.terms — trimmed of anything tied to features this build doesn't
// have (the Shop tab, brand/partner reorder codes, box-scan tracking) so nothing
// here promises something the app doesn't actually do.

export const LEGAL_LAST_UPDATED = "September 2026";

export type LegalSection = { h: string; body: string };

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    h: "What we collect",
    body:
      "Your first name, email, and a password — stored by our authentication provider as a one-way hash, never in a form anyone can read back. The training details you give us: units, goal, and if you choose to enter them, your age, height, and weight. And the numbers you log: every session, set, and weight, plus any mobility or walk/run entries, notes, ratings, and tags you add.",
  },
  {
    h: "What we don't collect",
    body:
      "No location, no contacts, no camera or microphone access, no advertising identifiers. We don't run ad trackers or sell data to anyone — there's nothing here to sell.",
  },
  {
    h: "What we do with it",
    body:
      "We use it to run your program, prefill your next session from your last one, and show your progress. That's the whole purpose. It's never used to advertise to you, and it's never shared with anyone for their own marketing.",
  },
  {
    h: "Where it lives",
    body:
      "In your account, on servers in the United States, run by our database provider (Supabase). New data is saved to your phone first and syncs to the server when you have a connection, so the app keeps working if you're offline.",
  },
  {
    h: "Your controls",
    body:
      "Edit anything under Account, any time. Export a full copy of your data — every session, as a spreadsheet or a data file — from the same screen. Delete your account and everything in it from Account too; deletion is permanent and immediate, with no waiting period and no support ticket required.",
  },
  {
    h: "Children",
    body: "First Timer is for people 13 and up. We don't knowingly collect data from anyone younger.",
  },
  {
    h: "Changes",
    body:
      "If this policy changes in a way that matters, we'll tell you in the app before it takes effect, not just by updating this page.",
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    h: "Not medical advice",
    body:
      "This program is written for healthy beginners. It doesn't replace advice from a doctor, and it isn't a substitute for medical care. If something hurts, stop — the app has a swap or skip for exactly that, on every movement.",
  },
  {
    h: "Your account",
    body:
      "You're responsible for keeping your password private and for what happens under your account. Tell us if you think someone else has access to it.",
  },
  {
    h: "Purchases",
    body:
      "Some parts of the app may require a purchase made through the App Store or Google Play. Pricing and what you get are shown before you buy. Refunds follow that store's own policies, not ours — we don't process payments directly and never see your card details.",
  },
  {
    h: "Your content",
    body:
      "What you log — your sessions, notes, weights, ratings — is yours. We store it to run the app and show it back to you. Deleting your account deletes it, permanently.",
  },
  {
    h: "No guarantees",
    body:
      "The app is provided as-is. We work to keep it accurate and available, but we can't promise it will be error-free or uninterrupted, and we're not liable for injury from following the program — see \"Not medical advice\" above.",
  },
  {
    h: "Changes",
    body: "We'll tell you in the app before these terms change in any way that matters.",
  },
];
