-- Adds the onboarding fields collected by the new multi-step onboarding wizard.
-- medical_disclaimer_accepted doubles as the "has this account finished onboarding"
-- gate (screens/OnboardingScreen.tsx) — existing accounts are backfilled to true
-- below so current users aren't suddenly dropped into the wizard.

alter table profiles
  add column if not exists days int not null default 3,
  add column if not exists activity text,
  add column if not exists why text,
  add column if not exists medical_disclaimer_accepted boolean not null default false;

update profiles set medical_disclaimer_accepted = true where medical_disclaimer_accepted = false;
