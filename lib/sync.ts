// Talks to the Supabase tables defined in supabase/schema.sql. Kept deliberately thin:
// no queue, no retry, no conflict resolution — per the sync rule in CLAUDE.md, a push
// either succeeds or the local copy (already saved) just tries again next time
// commitSession/updateHistoryEntry runs.

import { supabase } from "./supabase";
import { HistoryEntry, MobilityEntry, Profile, Settings, WalkEntry, WalkKind } from "./types";

type ProfileRow = {
  id: string;
  name: string;
  units: string;
  training_location: string;
  reps: string;
  length: number;
  pain: string[];
  age: number | null;
  height_cm: number | null;
  weight: number | null;
  goal: string | null;
  settings: Partial<Settings> | null;
  block: number;
  session: number;
  streak: number;
  last_date: string | null;
};

type SessionRow = {
  id: string;
  block: number;
  idx: number;
  letter: string;
  week: number;
  date: string;
  moves: HistoryEntry["moves"];
  note: string;
  minutes: number;
  tags: string[] | null;
  rating: number | null;
  backfilled: boolean | null;
};

type MobilityRow = {
  id: string;
  date: string;
  minutes: number;
};

type WalkRow = {
  id: string;
  date: string;
  minutes: number;
  kind: string;
  feel: string | null;
  hurt: string[] | null;
};

export type RemoteState = {
  profile: Profile;
  settings: Partial<Settings> | null;
  block: number;
  session: number;
  streak: number;
  lastDate: string | null;
  history: HistoryEntry[];
  mobility: MobilityEntry[];
  walks: WalkEntry[];
};

function rowToHistoryEntry(row: SessionRow): HistoryEntry {
  return {
    id: row.id,
    block: row.block,
    idx: row.idx,
    letter: row.letter as any,
    week: row.week,
    date: row.date,
    moves: row.moves || {},
    note: row.note || "",
    minutes: row.minutes || 0,
    tags: row.tags || [],
    rating: row.rating ?? undefined,
    backfilled: row.backfilled ?? undefined,
  };
}

function rowToMobilityEntry(row: MobilityRow): MobilityEntry {
  return { id: row.id, date: row.date, minutes: row.minutes || 0 };
}
function rowToWalkEntry(row: WalkRow): WalkEntry {
  return {
    id: row.id,
    date: row.date,
    minutes: row.minutes || 0,
    kind: (row.kind as WalkKind) || "walk",
    feel: (row.feel as WalkEntry["feel"]) || "",
    hurt: row.hurt || [],
  };
}

export async function fetchRemoteState(userId: string): Promise<RemoteState | null> {
  const [{ data: profileRow, error: profileErr }, { data: sessionRows, error: sessionsErr }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>(),
    supabase.from("sessions").select("*").eq("user_id", userId).order("date", { ascending: true }),
  ]);
  if (profileErr) throw profileErr;
  if (sessionsErr) throw sessionsErr;
  if (!profileRow) return null;

  // Fetched separately, and never fatal to the rest of hydrate: these tables are
  // newer (migration 005) than profiles/sessions, so a project that hasn't run that
  // migration yet would otherwise take down profile/session sync entirely over two
  // tables that simply don't exist yet. Degrade to "no mobility/walk history yet."
  const [mobilityRes, walksRes] = await Promise.all([
    supabase.from("mobility_logs").select("*").eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("walks").select("*").eq("user_id", userId).order("date", { ascending: true }),
  ]);
  if (mobilityRes.error) console.warn("Mobility log fetch failed (migration 005 run yet?):", mobilityRes.error);
  if (walksRes.error) console.warn("Walk log fetch failed (migration 005 run yet?):", walksRes.error);
  const mobilityRows = mobilityRes.error ? [] : mobilityRes.data;
  const walkRows = walksRes.error ? [] : walksRes.data;

  return {
    profile: {
      name: profileRow.name || "",
      units: (profileRow.units as Profile["units"]) || "imperial",
      where: (profileRow.training_location as Profile["where"]) || "gym",
      reps: (profileRow.reps as Profile["reps"]) || "balanced",
      length: profileRow.length || 45,
      pain: (profileRow.pain as Profile["pain"]) || [],
      age: profileRow.age,
      heightCm: profileRow.height_cm,
      weight: profileRow.weight,
      goal: (profileRow.goal as Profile["goal"]) || null,
    },
    settings: profileRow.settings || null,
    block: profileRow.block || 1,
    session: profileRow.session || 0,
    streak: profileRow.streak || 0,
    lastDate: profileRow.last_date,
    history: ((sessionRows as SessionRow[]) || []).map(rowToHistoryEntry),
    mobility: ((mobilityRows as MobilityRow[]) || []).map(rowToMobilityEntry),
    walks: ((walkRows as WalkRow[]) || []).map(rowToWalkEntry),
  };
}

export async function pushProfile(
  userId: string,
  profile: Profile,
  meta: { block: number; session: number; streak: number; lastDate: string | null }
) {
  const row: Partial<ProfileRow> & { id: string } = {
    id: userId,
    name: profile.name,
    units: profile.units,
    training_location: profile.where,
    reps: profile.reps,
    length: profile.length,
    pain: profile.pain,
    age: profile.age,
    height_cm: profile.heightCm,
    weight: profile.weight,
    goal: profile.goal,
    block: meta.block,
    session: meta.session,
    streak: meta.streak,
    last_date: meta.lastDate,
  };
  const { error } = await supabase.from("profiles").upsert(row);
  if (error) throw error;
}

export async function pushSettings(userId: string, settings: Settings) {
  const { error } = await supabase.from("profiles").update({ settings }).eq("id", userId);
  if (error) throw error;
}

export async function pushSession(userId: string, entry: HistoryEntry) {
  const row: SessionRow & { user_id: string; updated_at: string } = {
    id: entry.id,
    user_id: userId,
    block: entry.block,
    idx: entry.idx,
    letter: entry.letter,
    week: entry.week,
    date: entry.date,
    moves: entry.moves,
    note: entry.note,
    minutes: entry.minutes,
    tags: entry.tags || [],
    rating: entry.rating ?? null,
    backfilled: entry.backfilled ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("sessions").upsert(row);
  if (error) throw error;
}

export async function deleteSession(userId: string, id: string) {
  const { error } = await supabase.from("sessions").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function pushMobility(userId: string, entry: MobilityEntry) {
  const row = { id: entry.id, user_id: userId, date: entry.date, minutes: entry.minutes, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("mobility_logs").upsert(row);
  if (error) throw error;
}

export async function pushWalk(userId: string, entry: WalkEntry) {
  const row = {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    minutes: entry.minutes,
    kind: entry.kind,
    feel: entry.feel,
    hurt: entry.hurt,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("walks").upsert(row);
  if (error) throw error;
}

// Dev-only: wipe this account's logged sessions and reset their block/session
// position, so the "one session a day" gate doesn't block repeated testing.
export async function resetTestData(userId: string) {
  const { error: delErr } = await supabase.from("sessions").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  await supabase.from("mobility_logs").delete().eq("user_id", userId);
  await supabase.from("walks").delete().eq("user_id", userId);
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ block: 1, session: 0, streak: 0, last_date: null })
    .eq("id", userId);
  if (profErr) throw profErr;
}
