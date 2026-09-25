// Talks to the Supabase tables defined in supabase/schema.sql. Kept deliberately thin:
// no queue, no retry, no conflict resolution — per the sync rule in CLAUDE.md, a push
// either succeeds or the local copy (already saved) just tries again next time
// commitSession/updateHistoryEntry runs.

import { supabase } from "./supabase";
import { HistoryEntry, Profile } from "./types";

type ProfileRow = {
  id: string;
  name: string;
  units: string;
  training_location: string;
  reps: string;
  length: number;
  pain: string[];
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
};

export type RemoteState = {
  profile: Profile;
  block: number;
  session: number;
  streak: number;
  lastDate: string | null;
  history: HistoryEntry[];
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

  return {
    profile: {
      name: profileRow.name || "",
      units: (profileRow.units as Profile["units"]) || "imperial",
      where: "gym",
      reps: (profileRow.reps as Profile["reps"]) || "balanced",
      length: profileRow.length || 45,
      pain: profileRow.pain || [],
    },
    block: profileRow.block || 1,
    session: profileRow.session || 0,
    streak: profileRow.streak || 0,
    lastDate: profileRow.last_date,
    history: ((sessionRows as SessionRow[]) || []).map(rowToHistoryEntry),
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
    block: meta.block,
    session: meta.session,
    streak: meta.streak,
    last_date: meta.lastDate,
  };
  const { error } = await supabase.from("profiles").upsert(row);
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
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("sessions").upsert(row);
  if (error) throw error;
}
