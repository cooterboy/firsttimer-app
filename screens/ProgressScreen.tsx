import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { BLOCK_SESSIONS, daysPer, unit, weekOf, weeksPerBlock } from "../lib/gymProgram";
import { fmtDate, historyMovedTotal, movedLabel, setsSummary } from "../lib/sessionEngine";
import { walkKindLabel } from "../lib/walkProgram";
import { HistoryEntry } from "../lib/types";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import SessionDetailSheet from "../components/SessionDetailSheet";

export default function ProgressScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const { history, mobility, walks, streak, block, session, profile } = appState;
  const [openKey, setOpenKey] = useState<{ block: number; idx: number } | null>(null);
  const openEntry = openKey ? history.find((h) => h.block === openKey.block && h.idx === openKey.idx) || null : null;
  const hasAnything = history.length > 0 || mobility.length > 0 || walks.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Progress</Text>

        {!hasAnything ? (
          <EmptyState colors={colors} />
        ) : (
          <>
            <Overview colors={colors} history={history} streak={streak} units={profile.units} />
            <WeekChart colors={colors} history={history} />
            <Blocks colors={colors} block={block} session={session} history={history} />
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
      </ScrollView>
      <SessionDetailSheet entry={openEntry} units={profile.units} onClose={() => setOpenKey(null)} />
    </SafeAreaView>
  );
}

function EmptyState({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const rows = [
    { k: "After session 1", s: "Your starting weights, and the first milestone ticked.", badge: "Today" },
    { k: "After session 4", s: "The same session again, side by side with the first.", badge: "Week 2" },
    { k: "Every Sunday", s: "A recap: sessions, weight moved, what went up.", badge: "Weekly" },
  ];
  return (
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
          <View style={[styles.badge, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{r.badge}</Text>
          </View>
        </View>
      ))}
    </Card>
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

function Blocks({
  colors,
  block,
  session,
  history,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
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
            <Text style={[styles.rowK, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Gym · Block {r.b}</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {r.n} of {BLOCK_SESSIONS} sessions{r.cur ? " · in progress" : ""}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: r.cur ? colors.sunken : colors.goodSoft }]}>
            <Text style={{ color: r.cur ? colors.muted : colors.good, fontSize: 10.5, fontWeight: "700" }}>
              {r.cur ? `Week ${weekOf(session)} of ${weeksPerBlock()}` : "Done"}
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
});
