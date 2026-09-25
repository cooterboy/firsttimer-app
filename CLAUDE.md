# First Timer — native app

Drop this file in the repo root. Every Claude Code session reads it automatically, so it
is the project's memory. Keep it current: when a decision changes, change it here.

## What this is

A training app for people who have never trained. It ships with a physical box that gyms
hand to new members on signup day; a QR code in the box brings them here. The app carries
the program, logs the sessions, and is the thing that proves the box works — the number
sold to gyms is month-two attendance, and this app is what measures it.

The audience is beginners. Every design decision follows from that: nothing assumes prior
knowledge, nothing punishes a missed day, and the app always has an answer for "the machine
is taken", "this is too hard", "this hurts", "I'm short on time".

## The spec

**A complete working prototype exists and it is the specification.** Every screen, state,
empty state, error case and word of copy is already decided and demonstrably working.

- Live: https://claude.ai/artifact/648fPNTLmr6ced5ZDvnzjw
- Source: `spec/prototype.html` in this repo (single self-contained HTML file, ~3,600 lines)

**When building a screen, read the prototype's code for that screen first.** The logic is
written and tested. Port it rather than reinventing it. Copy the copy verbatim — the wording
was worked over carefully and is part of the product.

Do not treat the prototype as legacy code to be improved. Treat it as the answer.

## Stack, and why

| Layer | Choice | Reason |
|---|---|---|
| App | Expo (React Native) | One codebase, both stores, cloud builds via EAS — no Mac required |
| Backend | Supabase | Auth + Postgres + storage in one, free at pilot scale |
| Purchases | RevenueCat | Hand-rolling StoreKit and Play Billing is the worst part of the build |
| Push | Expo Notifications | Built in |
| Video | Bunny.net or Cloudflare Stream | 25 clips of ~20 seconds |
| Errors | Sentry | Free tier |

## The sync rule — do not build the complicated version

Sessions are append-only. One person, one phone, one session at a time. Two devices editing
the same set simultaneously is not a real scenario.

**So: client-generated UUID on every record, write local first, push when online,
last-write-wins on collision. No merge logic. No conflict resolution. No sync engine.**

This is a deliberate decision that removes the single most expensive part of the build.
If a suggestion involves CRDTs, operational transforms or a sync library, it is out of scope.

## v1 scope

**In:** onboarding, the session flow (warm-up, movements, sets, rest timer, swaps, skip,
notes, first-weight finder, movement navigation, celebration, results), mobility day,
walk/run, Progress (overview, lifts, body, history), backfill a missed session, settings,
account, data export, paywall.

**Cut from v1** — present in the prototype, deliberately not shipping first:
Friends, connected accounts, Partner preview, Demo account, the Shop tab, the Programs tab
(Hyrox and Marathon are empty stubs), Milestones, Goals.

Cutting these is roughly 40% of the surface area. Do not quietly add them back.

## Conventions

- One screen per file. Business logic in `lib/`, not in components.
- The design tokens come from the prototype's `:root` CSS variables — same colors, same type
  scale, same three-state theming (light / system dark / forced dark).
- Copy is content, not filler. If a string needs changing, that is a product decision.
- Commit after every working screen. Small commits, real messages.
- Test on a real phone before moving to the next screen.

## Build order

1. Scaffold, navigation, design tokens, Today tab rendering on a real phone
2. The session flow end to end — this is the core, get it right before anything else
3. Supabase auth and sync
4. Progress, charts, history
5. Mobility, walk/run
6. Settings, account, export
7. RevenueCat, push notifications
8. Store submission

## Accounts, all in Cooper's name

GitHub · Expo · Supabase · Apple Developer ($99/yr, needs a D-U-N-S number tied to the LLC) ·
Google Play ($25 once) · RevenueCat · Sentry · video host.

Never create one of these under anyone else's account.

## Before launch

Pay a developer $1–2k for a code review and security pass, focused on auth, database
row-level security, the purchase flow, and anything touching user data.
