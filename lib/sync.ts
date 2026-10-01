// Talks to the Supabase tables defined in supabase/schema.sql. Kept deliberately thin:
// no queue, no retry, no conflict resolution — per the sync rule in CLAUDE.md, a push
// either succeeds or the local copy (already saved) just tries again next time
// commitSession/updateHistoryEntry runs.

import { supabase } from "./supabase";
import { Friend, HistoryEntry, MobilityEntry, Profile, Purchase, Settings, WalkEntry, WalkKind, WeighIn } from "./types";
import { BaseMovement, MovementParams, MovementType, MovementVariant, Program } from "./gymProgram";
import { Gym } from "./gyms";

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
  days: number;
  activity: string | null;
  why: string | null;
  medical_disclaimer_accepted: boolean;
  friends_opt_in: boolean;
  box_code: string | null;
  city: string | null;
  recovery_adjusted_at: string | null;
  gym_code: string | null;
  gym_set_at: string | null;
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

type WeighInRow = {
  id: string;
  date: string;
  w: number;
};

type FriendRow = {
  id: string;
  name: string;
  code: string;
  bumped: boolean;
  date: string;
};

type ConnectedAccountRow = {
  network: string;
  connected: boolean;
};

type ProgramNotifyRow = {
  category: string;
  notify: boolean;
};

type PurchaseRow = {
  id: string;
  label: string;
  price: number;
  blocks: number;
  product_id: string | null;
  date: string;
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
  weighins: WeighIn[];
  friends: Friend[];
  connectedAccounts: Record<string, boolean>;
  notify: Record<string, boolean>;
  purchases: Purchase[];
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
function rowToWeighIn(row: WeighInRow): WeighIn {
  return { id: row.id, date: row.date, w: Number(row.w) || 0 };
}
function rowToFriend(row: FriendRow): Friend {
  return { id: row.id, name: row.name, code: row.code, bumped: !!row.bumped, date: row.date };
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
  // newer (migrations 005/006/008) than profiles/sessions, so a project that hasn't
  // run those yet would otherwise take down profile/session sync entirely over
  // tables that simply don't exist yet. Degrade to "no history for this one yet"
  // instead.
  const [mobilityRes, walksRes, weighinsRes, friendsRes, socialRes, notifyRes, purchasesRes] = await Promise.all([
    supabase.from("mobility_logs").select("*").eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("walks").select("*").eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("weighins").select("*").eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("friends").select("*").eq("user_id", userId).order("date", { ascending: true }),
    supabase.from("connected_accounts").select("*").eq("user_id", userId),
    supabase.from("program_notify").select("*").eq("user_id", userId),
    supabase.from("purchases").select("*").eq("user_id", userId).order("date", { ascending: true }),
  ]);
  if (mobilityRes.error) console.warn("Mobility log fetch failed (migration 005 run yet?):", mobilityRes.error);
  if (walksRes.error) console.warn("Walk log fetch failed (migration 005 run yet?):", walksRes.error);
  if (weighinsRes.error) console.warn("Weigh-in fetch failed (migration 006 run yet?):", weighinsRes.error);
  if (friendsRes.error) console.warn("Friends fetch failed (migration 008 run yet?):", friendsRes.error);
  if (socialRes.error) console.warn("Connected-accounts fetch failed (migration 008 run yet?):", socialRes.error);
  if (notifyRes.error) console.warn("Program-notify fetch failed (migration 008 run yet?):", notifyRes.error);
  if (purchasesRes.error) console.warn("Purchases fetch failed (migration 008 run yet?):", purchasesRes.error);
  const mobilityRows = mobilityRes.error ? [] : mobilityRes.data;
  const walkRows = walksRes.error ? [] : walksRes.data;
  const weighinRows = weighinsRes.error ? [] : weighinsRes.data;
  const friendRows = friendsRes.error ? [] : friendsRes.data;
  const socialRows: ConnectedAccountRow[] = socialRes.error ? [] : socialRes.data;
  const notifyRows: ProgramNotifyRow[] = notifyRes.error ? [] : notifyRes.data;
  const purchaseRows = purchasesRes.error ? [] : purchasesRes.data;

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
      days: (profileRow.days as Profile["days"]) || 3,
      activity: (profileRow.activity as Profile["activity"]) || null,
      why: (profileRow.why as Profile["why"]) || null,
      medicalDisclaimerAccepted: !!profileRow.medical_disclaimer_accepted,
      friendsOptIn: !!profileRow.friends_opt_in,
      boxCode: profileRow.box_code || "",
      city: profileRow.city || "",
      recoveryAdjustedAt: profileRow.recovery_adjusted_at || null,
      gymCode: profileRow.gym_code ?? null,
      gymSetAt: profileRow.gym_set_at ?? null,
    },
    settings: profileRow.settings || null,
    block: profileRow.block || 1,
    session: profileRow.session || 0,
    streak: profileRow.streak || 0,
    lastDate: profileRow.last_date,
    history: ((sessionRows as SessionRow[]) || []).map(rowToHistoryEntry),
    mobility: ((mobilityRows as MobilityRow[]) || []).map(rowToMobilityEntry),
    walks: ((walkRows as WalkRow[]) || []).map(rowToWalkEntry),
    weighins: ((weighinRows as WeighInRow[]) || []).map(rowToWeighIn),
    friends: ((friendRows as FriendRow[]) || []).map(rowToFriend),
    connectedAccounts: Object.fromEntries(socialRows.map((r) => [r.network, !!r.connected])),
    notify: Object.fromEntries(notifyRows.map((r) => [r.category, !!r.notify])),
    purchases: ((purchaseRows as PurchaseRow[]) || []).map((r) => ({ id: r.id, label: r.label, price: Number(r.price) || 0, blocks: r.blocks || 1, productId: r.product_id, date: r.date })),
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
    days: profile.days,
    activity: profile.activity,
    why: profile.why,
    medical_disclaimer_accepted: profile.medicalDisclaimerAccepted,
    friends_opt_in: profile.friendsOptIn,
    box_code: profile.boxCode || null,
    city: profile.city || null,
    recovery_adjusted_at: profile.recoveryAdjustedAt,
    // Left undefined (so omitted, not nulled) by a profile cached before these
    // fields existed — an older cache never wipes an answer saved elsewhere.
    gym_code: profile.gymCode,
    gym_set_at: profile.gymSetAt,
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

export async function pushWeighIn(userId: string, entry: WeighIn) {
  const row = { id: entry.id, user_id: userId, date: entry.date, w: entry.w, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("weighins").upsert(row);
  if (error) throw error;
}

export async function deleteWeighIn(userId: string, id: string) {
  const { error } = await supabase.from("weighins").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function pushFriend(userId: string, entry: Friend) {
  const row = { id: entry.id, user_id: userId, name: entry.name, code: entry.code, bumped: entry.bumped, date: entry.date };
  const { error } = await supabase.from("friends").upsert(row);
  if (error) throw error;
}

export async function pushConnectedAccount(userId: string, network: string, connected: boolean) {
  const row = { user_id: userId, network, connected, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("connected_accounts").upsert(row, { onConflict: "user_id,network" });
  if (error) throw error;
}

export async function pushProgramNotify(userId: string, category: string, notify: boolean) {
  const row = { user_id: userId, category, notify, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("program_notify").upsert(row, { onConflict: "user_id,category" });
  if (error) throw error;
}

export async function pushPurchase(userId: string, entry: Purchase) {
  const row = {
    id: entry.id,
    user_id: userId,
    label: entry.label,
    price: entry.price,
    blocks: entry.blocks,
    product_id: entry.productId ?? null,
    date: entry.date,
  };
  const { error } = await supabase.from("purchases").upsert(row);
  if (error) throw error;
}

// Dev-only: wipe this account's logged sessions and reset their block/session
// position, so the "one session a day" gate doesn't block repeated testing.
export async function resetTestData(userId: string) {
  const { error: delErr } = await supabase.from("sessions").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  await supabase.from("mobility_logs").delete().eq("user_id", userId);
  await supabase.from("walks").delete().eq("user_id", userId);
  await supabase.from("weighins").delete().eq("user_id", userId);
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ block: 1, session: 0, streak: 0, last_date: null })
    .eq("id", userId);
  if (profErr) throw profErr;
}

// Content tables (migrations 013/014), in the nested shape PROGRAM_SELECT returns.
type CategoryRow = { key: string; name: string; sub: string; live: boolean; sort_order: number };
type ExerciseRow = { name: string; cue: string; why: string | null };
type AlternativeRow = {
  reason: string;
  pain_area: string | null;
  kind: string | null;
  per_side: boolean | null;
  cue_override: string | null;
  exercise: ExerciseRow;
};
type TemplateMovementRow = {
  position: number;
  kind: string;
  rest_sec: number | null;
  per_side: boolean;
  cue_override: string | null;
  params: MovementParams | null;
  exercise: ExerciseRow;
  movement_alternatives: AlternativeRow[];
};
export type ProgramRow = {
  id: string;
  category: string;
  where_keys: string[];
  name: string;
  block_sessions: number;
  sort_order: number;
  session_templates: { code: string; label: string; position: number; template_movements: TemplateMovementRow[] }[];
};

// A `categories` row — one card on the Programs tab (gym live; hyrox/marathon
// "Tell me" cards until they ship).
export type CategoryInfo = { key: string; name: string; sub: string; live: boolean };
export type ProgramContent = {
  categories: CategoryInfo[];
  programs: Program[]; // live plans only, in sort_order
};

// Both exercise embeds name their foreign key: movement_alternatives links
// template_movements to exercises, so PostgREST would otherwise also see a
// many-to-many path between them and refuse the embed as ambiguous.
const PROGRAM_SELECT = `
  id, category, where_keys, name, block_sessions, sort_order,
  session_templates (
    code, label, position,
    template_movements (
      position, kind, rest_sec, per_side, cue_override, params,
      exercise:exercises!template_movements_exercise_id_fkey ( name, cue, why ),
      movement_alternatives (
        reason, pain_area, kind, per_side, cue_override,
        exercise:exercises!movement_alternatives_exercise_id_fkey ( name, cue, why )
      )
    )
  )`;

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

// Null columns become absent keys, not `undefined` values: buildSession spreads
// an alternative over its slot, and an explicit undefined would erase the
// slot's value instead of inheriting it (the prototype's `alt.type || m.type`).
function rowToVariant(a: AlternativeRow): MovementVariant {
  const v: MovementVariant = { n: a.exercise.name, cue: a.cue_override ?? a.exercise.cue };
  if (a.kind) v.type = a.kind as MovementType;
  if (a.per_side !== null) v.perSide = a.per_side;
  if (a.exercise.why) v.why = a.exercise.why;
  return v;
}

function rowToBaseMovement(row: TemplateMovementRow): BaseMovement {
  const alts = row.movement_alternatives || [];
  const swap = alts.find((a) => a.reason === "swap");
  const easier = alts.find((a) => a.reason === "easier");
  const pain = alts.filter((a) => a.reason === "pain" && a.pain_area);
  const m: BaseMovement = {
    n: row.exercise.name,
    cue: row.cue_override ?? row.exercise.cue,
    type: row.kind as MovementType,
    rest: row.rest_sec ?? 0, // 0 → the user's default rest (prepareWorkoutMoves)
  };
  if (row.per_side) m.perSide = true;
  if (swap) m.sub = rowToVariant(swap);
  if (easier) m.easier = rowToVariant(easier);
  if (pain.length) m.pain = Object.fromEntries(pain.map((a) => [a.pain_area as string, rowToVariant(a)]));
  if (row.exercise.why) m.why = row.exercise.why;
  if (row.params && Object.keys(row.params).length) m.params = row.params;
  return m;
}

// Pure, so it can be tested against real rows without a Supabase connection.
export function rowsToProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    category: row.category,
    whereKeys: row.where_keys,
    name: row.name,
    blockSessions: row.block_sessions,
    templates: [...(row.session_templates || [])].sort(byPosition).map((t) => ({
      code: t.code,
      label: t.label,
      moves: [...(t.template_movements || [])].sort(byPosition).map(rowToBaseMovement),
    })),
  };
}

// Fetches the content layer — the category cards, and every live plan with its
// sessions, movements and alternatives — in two requests. Never fatal: on any
// error the app stays on its cached copy, or lib/gymProgram.ts's GYM_PROGRAM on
// a fresh offline install (see lib/appState.tsx).
export async function fetchProgramContent(): Promise<ProgramContent | null> {
  const [categoriesRes, programsRes] = await Promise.all([
    supabase.from("categories").select("key, name, sub, live, sort_order").order("sort_order", { ascending: true }),
    supabase.from("programs").select(PROGRAM_SELECT).eq("live", true).order("sort_order", { ascending: true }),
  ]);
  if (categoriesRes.error || programsRes.error) {
    console.warn("Program content fetch failed (migrations 013/014 run yet?):", categoriesRes.error || programsRes.error);
    return null;
  }
  return {
    categories: ((categoriesRes.data as CategoryRow[]) || []).map((c) => ({ key: c.key, name: c.name, sub: c.sub, live: c.live })),
    programs: ((programsRes.data as unknown as ProgramRow[]) || []).map(rowsToProgram),
  };
}

type ShopItemRow = {
  id: string;
  category: string;
  section: string;
  name: string;
  blurb: string;
  link: string | null;
  sort_order: number;
};

export type ShopItem = {
  id: string;
  category: string;
  section: "in_your_box" | "gear";
  name: string;
  blurb: string;
  link: string | null;
  sortOrder: number;
};

// Same shape/pattern as fetchProgramContent() above — shop content as data (migration
// 012), never fatal (a fresh install or offline launch just shows an empty shop until
// this succeeds; see lib/appState.tsx).
// The gyms list for the "which gym gave you your box" question (migration 019).
// Returns null on any error, so the screen can offer a retry instead of an empty list.
export async function fetchGyms(): Promise<Gym[] | null> {
  const { data, error } = await supabase.from("gyms").select("code, name, active, sort_order").order("sort_order", { ascending: true });
  if (error) {
    console.warn("Gyms fetch failed (migration 019 run yet?):", error);
    return null;
  }
  return ((data as { code: string; name: string; active: boolean; sort_order: number }[]) || []).map((g) => ({
    code: g.code,
    name: g.name,
    active: g.active,
    sortOrder: g.sort_order,
  }));
}

export async function fetchShopItems(): Promise<ShopItem[] | null> {
  const { data, error } = await supabase.from("shop_items").select("*").order("sort_order", { ascending: true });
  if (error) {
    console.warn("Shop items fetch failed (migration 012 run yet?):", error);
    return null;
  }
  return ((data as ShopItemRow[]) || []).map((row) => ({
    id: row.id,
    category: row.category,
    section: row.section as ShopItem["section"],
    name: row.name,
    blurb: row.blurb,
    link: row.link,
    sortOrder: row.sort_order,
  }));
}
