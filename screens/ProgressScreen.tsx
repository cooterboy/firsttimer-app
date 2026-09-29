import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { Program, daysPer, unit, weekOf, weeksPerBlock } from "../lib/gymProgram";
import {
  buildSessionForProfile,
  fmtDate,
  historyMovedTotal,
  liftDeltas,
  Milestone,
  milestoneList,
  movedLabel,
  newWeighIn,
  setsSummary,
  tagCounts,
  weeklyWeights,
  weekKey,
  weekRecap,
  weighedThisWeek,
} from "../lib/sessionEngine";
import { walkKindLabel } from "../lib/walkProgram";
import { HistoryEntry, WeighIn } from "../lib/types";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import SessionDetailSheet from "../components/SessionDetailSheet";
import MovementDetailSheet from "../components/MovementDetailSheet";
import WeighInDetailSheet from "../components/WeighInDetailSheet";
import RecapCard from "../components/RecapCard";

type ProgressTab = "overview" | "lifts" | "body" | "history";
const PROGRESS_TABS: { v: ProgressTab; l: string }[] = [
  { v: "overview", l: "Overview" },
  { v: "lifts", l: "Lifts" },
  { v: "body", l: "Body" },
  { v: "history", l: "History" },
];

export default function ProgressScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const { history, mobility, walks, weighins, streak, block, session, profile } = appState;
  const [tab, setTab] = useState<ProgressTab>("overview");
  const [openKey, setOpenKey] = useState<{ block: number; idx: number } | null>(null);
  const openEntry = openKey ? history.find((h) => h.block === openKey.block && h.idx === openKey.idx) || null : null;
  const [openLift, setOpenLift] = useState<string | null>(null);
  const [openWeighInId, setOpenWeighInId] = useState<string | null>(null);
  const openWeighIn = openWeighInId ? weighins.find((w) => w.id === openWeighInId) || null : null;
  const hasAnything = history.length > 0 || mobility.length > 0 || walks.length > 0;
  const milestones = milestoneList(history, mobility, walks, streak, block, profile.units);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Progress</Text>

        {!hasAnything ? (
          <EmptyState colors={colors} program={appState.program} block={block} profile={profile} />
        ) : (
          <>
            <ProgressSeg value={tab} onChange={setTab} />

            {tab === "overview" ? (
              <>
                <Overview colors={colors} history={history} streak={streak} units={profile.units} />
                <WeekChart colors={colors} history={history} />
                <BiggestMovesCard colors={colors} history={history} units={profile.units} />
                <RecapCard recap={weekRecap(history, mobility, walks, 0)} label="This week" units={profile.units} />
                <RecapCard recap={weekRecap(history, mobility, walks, 1)} label="Last week" units={profile.units} />
                <TagsCard colors={colors} history={history} />
                <ClosestMilestonesCard milestones={milestones} />
                <MilestonesCard milestones={milestones} />
              </>
            ) : tab === "lifts" ? (
              <Lifts colors={colors} history={history} units={profile.units} onOpen={setOpenLift} />
            ) : tab === "body" ? (
              <Body
                colors={colors}
                weighins={weighins}
                units={profile.units}
                onLog={appState.commitWeighIn}
                onUpdate={appState.updateWeighIn}
                onOpen={setOpenWeighInId}
              />
            ) : (
              <>
                <Blocks colors={colors} program={appState.program} block={block} session={session} history={history} />
                <History
                  colors={colors}
                  history={history}
                  units={profile.units}
                  mobility={mobility}
                  walks={walks}
                  onOpen={(h) => setOpenKey({ block: h.block, idx: h.idx })}
                  onBackfill={() => navigation.navigate("Backfill")}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
      <SessionDetailSheet entry={openEntry} units={profile.units} history={history} onClose={() => setOpenKey(null)} />
      <MovementDetailSheet name={openLift} history={history} units={profile.units} onClose={() => setOpenLift(null)} />
      <WeighInDetailSheet entry={openWeighIn} units={profile.units} onClose={() => setOpenWeighInId(null)} />
    </SafeAreaView>
  );
}

// Ports the prototype's #progSeg segmented control (spec/prototype.html), matching
// the same pill-toggle pattern SettingsScreen's theme-mode Seg<T> already uses —
// there wasn't a shared component to import (Seg<T> is private to SettingsScreen.tsx),
// so this is a local equivalent sized for four full-width segments.
function ProgressSeg({ value, onChange }: { value: ProgressTab; onChange: (v: ProgressTab) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: colors.sunken }]}>
      {PROGRESS_TABS.map((o) => {
        const on = value === o.v;
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            key={o.v}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.v);
            }}
            style={[styles.segBtn, on && { backgroundColor: colors.raised }]}
          >
            <Text style={{ color: on ? colors.ink : colors.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>{o.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function EmptyState({
  colors,
  program,
  block,
  profile,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  program: Program;
  block: number;
  profile: ReturnType<typeof useAppState>["profile"];
}) {
  const rows = [
    { k: "After session 1", s: "Your starting weights, and the first milestone ticked.", badge: "Today" },
    {
      k: "After session 4",
      s: "The same session again, side by side with the first. This is the one people screenshot.",
      badge: "Week 2",
    },
    { k: "After week 2", s: "Patterns: what the app notices in your notes, tags and ratings.", badge: "Week 2" },
    { k: "Every Sunday", s: "A recap: sessions, weight moved, what went up.", badge: "Weekly" },
    { k: "Whenever you want", s: "Body weight and progress photos. Both optional, both private.", badge: "Optional" },
  ];
  const s0 = buildSessionForProfile(program, block, 0, profile);
  return (
    <>
      <Card>
        <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Nothing here yet, on purpose</Text>
        <Text style={[styles.note, { color: colors.muted, marginBottom: 12 }]}>
          This tab fills itself in as you train. Here's what lands where.
        </Text>
        {rows.map((r, i) => (
          <View key={r.k} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowK, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{r.k}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{r.s}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: i === 0 ? colors.accentSoft : colors.sunken }]}>
              <Text style={{ color: i === 0 ? colors.accent : colors.muted, fontSize: 10.5, fontWeight: "700" }}>
                {r.badge}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Your first numbers</Text>
        <Text style={[styles.note, { color: colors.muted, marginBottom: 4 }]}>
          These five get logged today. Whatever you lift is the right starting point — it's a measurement, not a
          test.
        </Text>
        {s0.moves.map((m, i) => (
          <View
            key={m.n}
            style={[styles.rowBetween, { paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
          >
            <Text style={[styles.rowK, { color: colors.ink }]}>{m.n}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{m.spec}</Text>
          </View>
        ))}
      </Card>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Closest milestone</Text>
        <View style={styles.msNext}>
          <View style={styles.rowBetween}>
            <Text style={[styles.rowK, { color: colors.ink }]}>First session</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>1 to go</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.sunken }]}>
            <View style={[styles.fill, { backgroundColor: colors.accent, width: "0%" }]} />
          </View>
        </View>
      </Card>
    </>
  );
}

function Overview({
  colors,
  history,
  streak,
  units,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  streak: number;
  units: "imperial" | "metric";
}) {
  const moved = historyMovedTotal(history);
  return (
    <View style={styles.tiles}>
      <Card style={styles.tile}>
        <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{history.length}</Text>
        <Text style={[styles.tileLabel, { color: colors.muted }]}>Sessions</Text>
      </Card>
      <Card style={styles.tile}>
        <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{streak}</Text>
        <Text style={[styles.tileLabel, { color: colors.muted }]}>In a row</Text>
      </Card>
      <Card style={styles.tile}>
        <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{movedLabel(moved)}</Text>
        <Text style={[styles.tileLabel, { color: colors.muted }]}>{unit(units)} moved</Text>
      </Card>
    </View>
  );
}

function WeekChart({ colors, history }: { colors: ReturnType<typeof useTheme>["colors"]; history: ReturnType<typeof useAppState>["history"] }) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dow);

  const counts: { label: string; n: number }[] = [];
  for (let k = 7; k >= 0; k--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - 7 * k);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const n = history.filter((h) => {
      const d = new Date(h.date);
      return d >= start && d < end;
    }).length;
    counts.push({ label: k === 0 ? "now" : `${start.getMonth() + 1}/${start.getDate()}`, n });
  }

  const W = 340,
    H = 120,
    pad = 22,
    bw = (W - pad * 2) / 8;
  const max = Math.max(daysPer(), ...counts.map((c) => c.n));

  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Sessions a week</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {Array.from({ length: max }).map((_, i) => {
          const g = i + 1;
          const y = H - 24 - (g / max) * (H - 40);
          return (
            <React.Fragment key={g}>
              <Line x1={pad} x2={W - pad} y1={y} y2={y} stroke={colors.line} strokeWidth={1} />
              <SvgText x={pad - 4} y={y + 3} fontSize={9} fill={colors.muted} textAnchor="end">
                {g}
              </SvgText>
            </React.Fragment>
          );
        })}
        {counts.map((c, i) => {
          const h = c.n ? (c.n / max) * (H - 40) : 0;
          const x = pad + i * bw + bw * 0.2;
          return (
            <React.Fragment key={i}>
              <Rect
                x={x}
                y={H - 24 - Math.max(h, c.n ? 0 : 2)}
                width={bw * 0.6}
                height={Math.max(h, c.n ? 0 : 2)}
                rx={3}
                fill={c.n ? colors.accent : colors.line}
              />
              <SvgText x={x + bw * 0.3} y={H - 8} fontSize={9} fill={colors.muted} textAnchor="middle">
                {c.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <Text style={[styles.note, { color: colors.muted, marginTop: 6 }]}>
        Target is {daysPer()} a week. A missed week just means the next session is waiting.
      </Text>
    </Card>
  );
}

function Lifts({
  colors,
  history,
  units,
  onOpen,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  units: "imperial" | "metric";
  onOpen: (name: string) => void;
}) {
  const d = liftDeltas(history);
  const names = Object.keys(d);
  const u = unit(units);
  const maxCount = names.length ? Math.max(...names.map((n) => d[n].count)) : 0;

  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Week 1 vs now</Text>
      {!names.length ? (
        <Text style={[styles.note, { color: colors.muted }]}>
          Log a weight in session 1 and it shows up here. From session 4 on, the change shows next to it.
        </Text>
      ) : (
        <>
          {names.map((n, i) => {
            const x = d[n];
            const pct = x.first ? Math.round(((x.last - x.first) / x.first) * 100) : 0;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                key={n}
                onPress={() => onOpen(n)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowK, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{n}</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>
                    {x.count} session{x.count === 1 ? "" : "s"} logged
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontFamily: fonts.monoBold, fontSize: 13 }}>
                  {x.first} → {x.last} {u}
                  {x.delta > 0 ? <Text style={{ color: colors.good }}> +{pct}%</Text> : null} ›
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>
            {maxCount < 2
              ? "A movement needs two sessions before it can draw a line, and each one comes round every third session."
              : "Each line is that movement's heaviest set over time. Tap one for the full history."}
          </Text>
        </>
      )}
    </Card>
  );
}

function Body({
  colors,
  weighins,
  units,
  onLog,
  onUpdate,
  onOpen,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  weighins: ReturnType<typeof useAppState>["weighins"];
  units: "imperial" | "metric";
  onLog: (entry: WeighIn) => void;
  onUpdate: (id: string, w: number) => void;
  onOpen: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const u = unit(units);
  const wi = weeklyWeights(weighins);
  const alreadyThisWeek = weighedThisWeek(weighins);

  // "Update this week" used to always push a new row (newWeighIn() mints a fresh id
  // every time), even though the button says "update" — that mismatch was the actual
  // source of duplicate weigh-ins, not just fat-fingering. Now it replaces whichever
  // entry is already logged for the current week instead of appending a second one.
  const submit = () => {
    const v = Number(input);
    if (!(v > 0)) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const thisWeek = weekKey(new Date());
    const existing = weighins.find((w) => weekKey(w.date) === thisWeek);
    if (existing) onUpdate(existing.id, v);
    else onLog(newWeighIn(v));
    setInput("");
    Alert.alert("Logged.");
  };

  const W = 340,
    H = 120,
    pad = 22;
  let chart: React.ReactNode = null;
  let trendNote = "";
  if (wi.length >= 2) {
    const ws = wi.map((x) => x.w);
    const lo = Math.min(...ws);
    const hi = Math.max(...ws);
    const span = hi - lo || 1;
    const pts = wi.map((x, i) => [pad + i * ((W - pad * 2) / Math.max(1, wi.length - 1)), H - 24 - ((x.w - lo) / span) * (H - 44)]);
    chart = (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={pts.map((p) => p.join(",")).join(" ")} stroke={colors.accent} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={colors.accent} />
        ))}
        <SvgText x={pad} y={H - 6} fontSize={9} fill={colors.muted}>
          {fmtDate(wi[0].date)} · {wi[0].w}
        </SvgText>
        <SvgText x={W - pad} y={H - 6} fontSize={9} fill={colors.muted} textAnchor="end">
          {fmtDate(wi[wi.length - 1].date)} · {wi[wi.length - 1].w}
        </SvgText>
      </Svg>
    );
    const chg = Math.round((wi[wi.length - 1].w - wi[0].w) * 10) / 10;
    trendNote = `One point per week, the latest weigh-in that week. ${chg === 0 ? "No change yet." : `${chg > 0 ? "+" : ""}${chg} ${u} since your first week.`}`;
  } else if (wi.length === 1) {
    trendNote = `Starting point: ${wi[0].w} ${u} on ${fmtDate(wi[0].date)}. The line starts with next week's weigh-in.`;
  } else {
    trendNote = "Optional. Only you see it. The app asks once a week on your first training day.";
  }

  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Body weight by week</Text>
      {chart}
      <Text style={[styles.note, { color: colors.muted, marginTop: chart ? 6 : 0, marginBottom: 10 }]}>{trendNote}</Text>
      <View style={styles.weighRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          placeholder={u}
          placeholderTextColor={colors.muted}
          style={[styles.weighInput, { color: colors.ink, backgroundColor: colors.sunken }]}
        />
        <TouchableOpacity activeOpacity={0.7} style={[styles.weighBtn, { borderColor: colors.line }]} onPress={submit}>
          <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
            {alreadyThisWeek ? "Update this week" : "Log weigh-in"}
          </Text>
        </TouchableOpacity>
      </View>
      {weighins.length ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[styles.eyebrowSmall, { color: colors.muted }]}>WEIGH-INS</Text>
          {weighins
            .slice()
            .reverse()
            .map((w, i) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={w.id}
                onPress={() => onOpen(w.id)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <Text style={[styles.rowK, { color: colors.ink }]}>{fmtDate(w.date)}</Text>
                <Text style={{ color: colors.ink, fontFamily: fonts.monoBold, fontSize: 13 }}>
                  {w.w} {u} ›
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      ) : null}
    </Card>
  );
}

// Ports the prototype's progTop (spec/prototype.html:2761) — the top 3 movements by
// weight increase, biggest first.
function BiggestMovesCard({
  colors,
  history,
  units,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  units: "imperial" | "metric";
}) {
  const d = liftDeltas(history);
  const names = Object.keys(d);
  const u = unit(units);
  const top = names
    .map((n) => ({ n, ...d[n] }))
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Biggest moves</Text>
      {top.length ? (
        top.map((x, i) => (
          <View key={x.n} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <Text style={[styles.rowK, { color: colors.ink }]}>{x.n}</Text>
            <Text style={{ color: colors.good, fontFamily: fonts.monoBold, fontSize: 13 }}>
              +{x.delta} {u}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[styles.note, { color: colors.muted }]}>
          {names.length ? "Nothing has gone up yet. Session 4 is usually the first jump." : "Your first weights land here after session 1."}
        </Text>
      )}
    </Card>
  );
}

// Ports the prototype's progTags (spec/prototype.html:2830-2832) — session tags and
// movement notes land here, counted the same way, sorted most-tagged first.
function TagsCard({ colors, history }: { colors: ReturnType<typeof useTheme>["colors"]; history: ReturnType<typeof useAppState>["history"] }) {
  const tags = tagCounts(history);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>What you've been tagging</Text>
      {tags.length ? (
        <>
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <View key={t.tag} style={[styles.tagBadge, { backgroundColor: colors.sunken }]}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {t.tag} · {t.count}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>
            Counts across every session. Two of the same thing is when the app starts saying something about it.
          </Text>
        </>
      ) : (
        <Text style={[styles.note, { color: colors.muted }]}>
          Tags from the finish screen and movement notes land here. The more you tag, the more the app can tell you.
        </Text>
      )}
    </Card>
  );
}

// Ports the prototype's progNext (spec/prototype.html:2823-2828) — the three locked
// milestones closest to being earned, by share of the target remaining.
function ClosestMilestonesCard({ milestones }: { milestones: Milestone[] }) {
  const { colors } = useTheme();
  const locked = milestones.filter((x) => !x.on);
  const next = locked
    .slice()
    .sort((a, b) => (a.at - a.cur) / a.at - (b.at - b.cur) / b.at)
    .slice(0, 3);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Closest milestones</Text>
      {next.length ? (
        next.map((x, i) => {
          const pct = Math.max(0, Math.min(100, Math.round((x.cur / x.at) * 100)));
          const left = x.at - x.cur;
          return (
            <View key={x.t} style={[styles.msNext, i > 0 && { marginTop: 12 }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.rowK, { color: colors.ink }]}>{x.t}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{left} to go</Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.sunken }]}>
                <View style={[styles.fill, { backgroundColor: colors.accent, width: `${pct}%` }]} />
              </View>
            </View>
          );
        })
      ) : (
        <Text style={[styles.note, { color: colors.muted }]}>Every milestone earned. New ones appear as the numbers climb.</Text>
      )}
    </Card>
  );
}

// Ports the prototype's progMilestones (spec/prototype.html:2834-2837). The "See all
// N milestones" button is left as a clearly-labeled not-yet-built state rather than
// silently wired to nothing — the prototype's full milestone-browser sub-screen
// (SUB.milestones, grouped by category) wasn't part of what was asked for here.
function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
  const { colors } = useTheme();
  const earned = milestones.filter((x) => x.on);
  const locked = milestones.filter((x) => !x.on);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Milestones</Text>
      <Text style={[styles.msCount, { color: colors.muted }]}>
        {earned.length} of {milestones.length} earned
      </Text>
      {earned.length ? (
        <View style={styles.tagRow}>
          {earned
            .slice()
            .reverse()
            .slice(0, 12)
            .map((x) => (
              <View key={x.t} style={[styles.tagBadge, { backgroundColor: colors.goodSoft }]}>
                <Text style={{ color: colors.good, fontSize: 12, fontWeight: "700" }}>✓ {x.t}</Text>
              </View>
            ))}
        </View>
      ) : (
        <Text style={[styles.note, { color: colors.muted, paddingVertical: 8 }]}>Your first one lands after session 1.</Text>
      )}
      {locked.length ? (
        <>
          <Text style={[styles.msCount, { color: colors.muted, marginTop: 14 }]}>Ahead of you</Text>
          <View style={styles.tagRow}>
            {locked.slice(0, 6).map((x) => (
              <View key={x.t} style={[styles.tagBadge, { backgroundColor: colors.sunken }]}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{x.t}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.ghostBtn, { borderColor: colors.line, marginTop: 14 }]}
        onPress={() => Alert.alert("Coming soon", "The full milestone list isn't built yet — this card already shows what's earned and what's close.")}
      >
        <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>See all {milestones.length} milestones</Text>
      </TouchableOpacity>
    </Card>
  );
}

function Blocks({
  colors,
  program,
  block,
  session,
  history,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  program: Program;
  block: number;
  session: number;
  history: ReturnType<typeof useAppState>["history"];
}) {
  const rows = [];
  for (let b = 1; b <= block; b++) {
    const n = history.filter((h) => h.block === b).length;
    const cur = b === block;
    rows.push({ b, n, cur });
  }
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Blocks</Text>
      {rows.map((r, i) => (
        <View key={r.b} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowK, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
              {program.name} · Block {r.b}
            </Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {r.n} of {program.blockSessions} sessions{r.cur ? " · in progress" : ""}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: r.cur ? colors.sunken : colors.goodSoft }]}>
            <Text style={{ color: r.cur ? colors.muted : colors.good, fontSize: 10.5, fontWeight: "700" }}>
              {r.cur ? `Week ${weekOf(session)} of ${weeksPerBlock(program.blockSessions)}` : "Done"}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function History({
  colors,
  history,
  units,
  mobility,
  walks,
  onOpen,
  onBackfill,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  units: "imperial" | "metric";
  mobility: ReturnType<typeof useAppState>["mobility"];
  walks: ReturnType<typeof useAppState>["walks"];
  onOpen: (entry: HistoryEntry) => void;
  onBackfill: () => void;
}) {
  type Row =
    | { kind: "session"; date: string; entry: HistoryEntry }
    | { kind: "mobility"; date: string; entry: (typeof mobility)[number] }
    | { kind: "walk"; date: string; entry: (typeof walks)[number] };
  const rows: Row[] = [
    ...history.map((entry) => ({ kind: "session" as const, date: entry.date, entry })),
    ...mobility.map((entry) => ({ kind: "mobility" as const, date: entry.date, entry })),
    ...walks.map((entry) => ({ kind: "walk" as const, date: entry.date, entry })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Every session</Text>
      {rows.map((row, i) => {
        const border = i > 0 && { borderTopWidth: 1, borderTopColor: colors.line };
        if (row.kind === "mobility") {
          const m = row.entry;
          return (
            <View key={m.id} style={[styles.histRow, border]}>
              <View style={styles.histTop}>
                <Text style={[styles.histTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Mobility day</Text>
                <Text style={[styles.histMeta, { color: colors.muted }]}>
                  {fmtDate(m.date)} · {m.minutes} min
                </Text>
              </View>
            </View>
          );
        }
        if (row.kind === "walk") {
          const w = row.entry;
          const bits = [
            w.feel ? { easy: "felt easy", right: "about right", hard: "felt hard" }[w.feel] : "",
            w.hurt.length ? `hurt: ${w.hurt.join(", ")}` : "",
          ].filter(Boolean);
          return (
            <View key={w.id} style={[styles.histRow, border]}>
              <View style={styles.histTop}>
                <Text style={[styles.histTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                  {walkKindLabel(w.kind)}
                </Text>
                <Text style={[styles.histMeta, { color: colors.muted }]}>
                  {fmtDate(w.date)} · {w.minutes} min
                </Text>
              </View>
              {bits.length ? <Text style={[styles.histDetail, { color: colors.muted }]}>{bits.join(" · ")}</Text> : null}
            </View>
          );
        }
        const h = row.entry;
        const notes = Object.keys(h.moves)
          .filter((n) => h.moves[n].note)
          .map((n) => `${n}: ${h.moves[n].note}`);
        const moveSummary = Object.keys(h.moves)
          .map((n) => {
            const m = h.moves[n];
            return `${n} ${m.type === "weight" ? setsSummary(m, units) : `${m.sets} sets`}`;
          })
          .join(" · ");
        return (
          <TouchableOpacity activeOpacity={0.7} key={h.id} onPress={() => onOpen(h)} style={[styles.histRow, border]}>
            <View style={styles.histTop}>
              <Text style={[styles.histTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                Block {h.block} · Session {h.idx + 1} · {h.letter}
              </Text>
              <Text style={[styles.histMeta, { color: colors.muted }]}>
                {fmtDate(h.date)} · Wk {h.week}
                {h.minutes ? ` · ${h.minutes} min` : ""}
              </Text>
            </View>
            <Text style={[styles.histDetail, { color: colors.muted }]}>{moveSummary}</Text>
            {h.rating ? (
              <Text style={{ color: colors.accentDeep, letterSpacing: 2, marginTop: 4, fontSize: 12 }}>
                {"★".repeat(h.rating)}
                <Text style={{ color: colors.line }}>{"★".repeat(5 - h.rating)}</Text>
              </Text>
            ) : null}
            {h.tags && h.tags.length ? (
              <View style={styles.tagRow}>
                {h.tags.map((t) => (
                  <View key={t} style={[styles.tagBadge, { backgroundColor: colors.sunken }]}>
                    <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {h.note ? <Text style={[styles.histNote, { color: colors.ink2 }]}>"{h.note}"</Text> : null}
            {notes.length ? <Text style={[styles.histNote, { color: colors.ink2 }]}>{notes.join(" · ")}</Text> : null}
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity activeOpacity={0.7} style={[styles.ghostBtn, { borderColor: colors.line }]} onPress={onBackfill}>
        <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
          Add a session I forgot
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  title: { fontSize: type.displayPageTitle, letterSpacing: 0.5, marginBottom: 14 },
  seg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2, marginBottom: spacing.md },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  sub: { fontSize: type.displaySub, letterSpacing: 0.5, marginBottom: 10 },
  note: { fontSize: type.note, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12 },
  rowK: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, alignItems: "center", padding: 14 },
  tileNum: { fontSize: 30, lineHeight: 30 },
  tileLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginTop: 4 },
  histRow: { paddingVertical: 12 },
  histTop: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  histTitle: { fontSize: 14 },
  histMeta: { fontSize: 12 },
  histDetail: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  histNote: { fontSize: 12, marginTop: 4, fontStyle: "italic" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ghostBtn: { borderWidth: 1, borderRadius: 13, padding: 13, alignItems: "center", marginTop: 16 },
  weighRow: { flexDirection: "row", gap: 8 },
  weighInput: { width: 100, padding: 12, borderRadius: 10, fontSize: 14 },
  weighBtn: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  eyebrowSmall: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  msNext: {},
  msCount: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  track: { height: 6, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});
