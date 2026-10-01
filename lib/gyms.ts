// The gyms a member can say they got their First Timer box from (migration 019) —
// the identifier the month-two attendance report groups by. The list is content:
// real gyms are Table Editor rows with active = true, so adding one needs no app
// change.

export type Gym = { code: string; name: string; active: boolean; sortOrder: number };

// The "Somewhere else / I didn't get a box" answer. Stored as gym_code = null with
// gym_set_at set — distinct from "never answered" (gym_set_at null).
export const GYM_OTHER = "__other__";
export const GYM_OTHER_LABEL = "Somewhere else / I didn't get a box";

// Which gyms the question lists: active ones, in sort order. Development builds
// (Expo Go, dev builds) also list inactive ones — that's how the inactive
// "TEST — Dev Gym" row can be picked on a test phone while real users never see it.
export function listedGyms(gyms: Gym[], includeInactive: boolean): Gym[] {
  return gyms.filter((g) => g.active || includeInactive).sort((a, b) => a.sortOrder - b.sortOrder);
}

// The onboarding/Account choice for a profile: a gym code, GYM_OTHER, or null
// when the question has never been answered.
export function gymChoiceFor(profile: { gymCode: string | null; gymSetAt: string | null }): string | null {
  if (!profile.gymSetAt) return null;
  return profile.gymCode ?? GYM_OTHER;
}

// The profile fields to save for a choice.
export function gymFieldsFor(choice: string, now: Date = new Date()): { gymCode: string | null; gymSetAt: string } {
  return { gymCode: choice === GYM_OTHER ? null : choice, gymSetAt: now.toISOString() };
}
