// Talks to the Supabase tables defined in supabase/schema.sql. Kept deliberately thin:
// no queue, no retry, no conflict resolution — per the sync rule in CLAUDE.md, a push
// either succeeds or the local copy (already saved) just tries again next time
// commitSession/updateHistoryEntry runs.

import { supabase } from "./supabase";
import { Friend, HistoryEntry, MobilityEntry, Profile, Purchase, Settings, WalkEntry, WalkKind, WeighIn } from "./types";
import { BaseMovement, Letter, MovementType, MovementVariant } from "./gymProgram";

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
    purchases: ((purchaseRows as PurchaseRow[]) || []).map((r) => ({ id: r.id, label: r.label, price: Number(r.price) || 0, blocks: r.blocks || 1, date: r.date })),
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
  const row = { id: entry.id, user_id: userId, label: entry.label, price: entry.price, blocks: entry.blocks, date: entry.date };
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

type ProgramRow = { category: string; name: string; sub: string; live: boolean };
type SessionTemplateRow = { id: string; category: string; letter: string; label: string; order_index: number };
type MovementRow = {
  id: string;
  category: string;
  session_template_id: string;
  order_index: number;
  n: string;
  cue: string;
  type: string;
  rest: number;
  per_side: boolean;
  sub: MovementVariantJson | null;
  easier: MovementVariantJson | null;
  pain: Record<string, MovementVariantJson> | null;
  video_url: string | null;
};
type MovementVariantJson = { n: string; cue: string; type?: string; perSide?: boolean };

export type ProgramInfo = { category: string; name: string; sub: string; live: boolean };
export type ProgramContent = {
  programs: ProgramInfo[];
  bank: Record<Letter, BaseMovement[]>;
};

function rowToVariant(v: MovementVariantJson): MovementVariant {
  return { n: v.n, cue: v.cue, type: v.type as MovementType | undefined, perSide: v.perSide };
}

function rowToBaseMovement(row: MovementRow): BaseMovement {
  const pain = row.pain
    ? Object.fromEntries(Object.entries(row.pain).map(([k, v]) => [k, rowToVariant(v)]))
    : undefined;
  return {
    n: row.n,
    cue: row.cue,
    type: row.type as BaseMovement["type"],
    rest: row.rest,
    perSide: row.per_side || undefined,
    sub: row.sub ? rowToVariant(row.sub) : undefined,
    easier: row.easier ? rowToVariant(row.easier) : undefined,
    pain,
  };
}

// Fetches the content layer (which programs exist, and the gym movement bank)
// from Supabase instead of lib/gymProgram.ts's hardcoded GYM constant. Never
// fatal — a fresh install or an offline first-launch falls back to that same
// hardcoded constant (see lib/appState.tsx), same graceful-degradation pattern
// as mobility_logs/walks/weighins.
export async function fetchProgramContent(): Promise<ProgramContent | null> {
  const [programsRes, templatesRes, movesRes] = await Promise.all([
    supabase.from("programs").select("*"),
    supabase.from("session_templates").select("*").eq("category", "gym").order("order_index", { ascending: true }),
    supabase.from("movements").select("*").eq("category", "gym").order("order_index", { ascending: true }),
  ]);
  if (programsRes.error || templatesRes.error || movesRes.error) {
    console.warn(
      "Program content fetch failed (migration 009 run yet?):",
      programsRes.error || templatesRes.error || movesRes.error
    );
    return null;
  }
  const templates = (templatesRes.data as SessionTemplateRow[]) || [];
  const templateLetter: Record<string, Letter> = {};
  templates.forEach((t) => (templateLetter[t.id] = t.letter as Letter));

  const bank: Record<Letter, BaseMovement[]> = { A: [], B: [], C: [] };
  ((movesRes.data as MovementRow[]) || []).forEach((row) => {
    const letter = templateLetter[row.session_template_id];
    if (!letter) return;
    bank[letter].push(rowToBaseMovement(row));
  });

  return {
    programs: ((programsRes.data as ProgramRow[]) || []).map((p) => ({ category: p.category, name: p.name, sub: p.sub, live: p.live })),
    bank,
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
