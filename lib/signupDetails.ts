// The name, units and age typed at sign-up travel with supabase.auth.signUp as
// user metadata. The database trigger (migration 017) copies them into the new
// profile row; this is the app's own copy of that step, for a database where 017
// hasn't run yet. Same checks as the trigger, so both paths accept the same values.
import { Profile } from "./types";

export function applySignupDetails(profile: Profile, meta: Record<string, unknown> | null | undefined): Profile {
  // Only ever fills a profile that was never set up — a profile with a name has
  // been through this already (or was filled in by hand), and is left alone.
  if (profile.name || !meta) return profile;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (!name) return profile;
  const units = meta.units === "imperial" || meta.units === "metric" ? meta.units : profile.units;
  const ageNum = Number(meta.age);
  const age = profile.age ?? (Number.isInteger(ageNum) && ageNum >= 13 && ageNum <= 120 ? ageNum : null);
  return { ...profile, name, units, age };
}
