import React from "react";
import { Text, View, StyleSheet } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { HistoryEntry, Units } from "../lib/types";
import { fmtDate, liftSeries } from "../lib/sessionEngine";
import { unit } from "../lib/gymProgram";
import Sheet from "./workout/Sheet";

// Prototype's SUB.lift — ported as a bottom sheet rather than a separate screen,
// matching how SessionDetailSheet already handles a past session's own detail.
export default function MovementDetailSheet({
  name,
  history,
  units,
  onClose,
}: {
  name: string | null;
  history: HistoryEntry[];
  units: Units;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!name) return null;
  const u = unit(units);
  const s = liftSeries(name, history);

  if (!s.length) {
    return (
      <Sheet visible={!!name} onClose={onClose}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>{name}</Text>
        <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>No weights logged for this one yet.</Text>
      </Sheet>
    );
  }

  const first = s[0];
  const last = s[s.length - 1];
  const dW = Math.round((last.top - first.top) * 10) / 10;
  const pct = first.top ? Math.round(((last.top - first.top) / first.top) * 100) : 0;
  const dV = Math.round((last.vol - first.vol) * 10) / 10;
  const vPct = first.vol ? Math.round(((last.vol - first.vol) / first.vol) * 100) : 0;

  let read: string;
  if (s.length < 2) {
    read = `Logged once, at ${last.top} ${u}. This movement comes round every third session — the chart draws itself the second time you do it.`;
  } else if (dW > 0) {
    read = `Up ${dW} ${u} on your heaviest set since ${fmtDate(first.date)}${pct ? ` — ${pct}% more` : ""}. Total work is ${vPct >= 0 ? "up" : "down"} ${Math.abs(vPct)}%.`;
  } else if (dV > 0) {
    read = `The weight hasn't moved, but you're doing ${vPct}% more total work than your first session on this. That's the same progress wearing different clothes.`;
  } else {
    read = `Flat so far. ${s.length < 4 ? "Most lifts move for the first time around session 4." : "If the last two felt easy, go up next time."}`;
  }

  const tally: Record<string, number> = {};
  s.forEach((x) => x.mtags.forEach((t) => (tally[t] = (tally[t] || 0) + 1)));
  const flags = Object.keys(tally).filter((t) => tally[t] >= 2);

  const tops = s.map((x) => x.top);
  const W = 280,
    H = 90,
    pad = 14;
  let chart: React.ReactNode = null;
  if (s.length >= 2) {
    const lo = Math.min(...tops);
    const hi = Math.max(...tops);
    const span = hi - lo || 1;
    const pts = tops.map((t, i) => [pad + i * ((W - pad * 2) / Math.max(1, tops.length - 1)), H - 14 - ((t - lo) / span) * (H - 28)]);
    chart = (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={pts.map((p) => p.join(",")).join(" ")} stroke={colors.accent} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p[0]} cy={p[1]} r={3} fill={colors.accent} />
        ))}
      </Svg>
    );
  }

  return (
    <Sheet visible={!!name} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>{name}</Text>
      <Text style={[styles.lede, { color: colors.ink2 }]}>{read}</Text>

      {chart ? (
        <View style={[styles.chartCard, { backgroundColor: colors.sunken }]}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>HEAVIEST SET PER SESSION</Text>
          {chart}
        </View>
      ) : null}

      {flags.length ? (
        <View style={[styles.flagBanner, { backgroundColor: colors.warnSoft }]}>
          <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>Coming up more than once: </Text>
            {flags.map((t) => `${t} ×${tally[t]}`).join(", ")}.{" "}
            {flags.includes("Joint ache") ? "Two or more of those is a physio question, not a program one." : "Worth a look at your form before your next set."}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>EVERY SESSION ON THIS MOVEMENT</Text>
      {s
        .slice()
        .reverse()
        .map((x, i) => {
          const feel = { easy: "felt easy", right: "about right", hard: "felt hard" }[x.feel] || "";
          const bits = [feel, ...x.mtags].filter(Boolean);
          return (
            <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowK, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                  {x.top} {u}
                </Text>
                <Text style={[styles.rowSub, { color: colors.muted }]}>
                  {x.sets} × {x.reps} · {fmtDate(x.date)} · wk {x.week}
                </Text>
                {bits.length ? <Text style={[styles.rowSub, { color: colors.muted }]}>{bits.join(" · ")}</Text> : null}
                {x.note ? <Text style={[styles.rowNote, { color: colors.ink2 }]}>"{x.note}"</Text> : null}
              </View>
              <View style={[styles.volBadge, { backgroundColor: colors.sunken }]}>
                <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>
                  {Math.round(x.vol).toLocaleString()} {u}
                </Text>
              </View>
            </View>
          );
        })}
      <Text style={[styles.note, { color: colors.muted, marginTop: spacing.md }]}>
        Weight is your heaviest set that day; work is every set added up — the one that keeps moving when the weight
        doesn't.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, letterSpacing: 0.5, marginBottom: 8 },
  lede: { fontSize: 14, lineHeight: 20 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  chartCard: { borderRadius: 12, padding: 14, marginTop: spacing.md },
  flagBanner: { borderRadius: 12, padding: 12, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  rowK: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  rowNote: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  volBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 2 },
  note: { fontSize: 12, lineHeight: 17 },
});
