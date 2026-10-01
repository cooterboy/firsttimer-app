import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { HistoryEntry, Units } from "../lib/types";
import { LiftPoint, fmtDate, liftSeries } from "../lib/sessionEngine";
import { unit, whyFor } from "../lib/gymProgram";
import { useAppState } from "../lib/appState";
import { blockRuns, formatTick, niceScale } from "../lib/chartScale";
import Sheet from "./workout/Sheet";

type Colors = ReturnType<typeof useTheme>["colors"];

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
  // The session the readout describes; null means the latest (the prototype's
  // say(s.length - 1)). Reset whenever a different movement opens.
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [name]);
  const { program } = useAppState();
  if (!name) return null;
  const why = whyFor(program, name);
  const u = unit(units);
  const s = liftSeries(name, history);

  if (!s.length) {
    return (
      <Sheet visible={!!name} onClose={onClose}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>{name}</Text>
        <WhatItWorks text={why} colors={colors} />
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

  const sel = picked !== null && picked < s.length ? picked : s.length - 1;
  const pick = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked(i);
  };

  return (
    <Sheet visible={!!name} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>{name}</Text>
      <WhatItWorks text={why} colors={colors} />
      <Text style={[styles.lede, { color: colors.ink2 }]}>{read}</Text>

      {s.length >= 2 ? (
        <View style={[styles.chartCard, { backgroundColor: colors.sunken }]}>
          <Text style={[styles.panelT, { color: colors.muted }]}>Heaviest set</Text>
          <Text style={[styles.panelS, { color: colors.ink2 }]}>The number you'd tell someone.</Text>
          <LiftChart kind="line" s={s} sel={sel} onPick={pick} colors={colors} label={`Heaviest set per session, in ${u}`} />

          <View style={[styles.panelRule, { borderTopColor: colors.line }]} />
          <Text style={[styles.panelT, { color: colors.muted }]}>Total work</Text>
          <Text style={[styles.panelS, { color: colors.ink2 }]}>Every set added up. Sets × reps × weight.</Text>
          <LiftChart kind="bar" s={s} sel={sel} onPick={pick} colors={colors} label={`Total work per session, in ${u}`} />

          <Readout x={s[sel]} u={u} colors={colors} />
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
        Both charts run left to right over the same sessions. Weight is your heaviest set that day; work is every set
        added up — the one that keeps moving when the weight doesn't.
      </Text>
    </Sheet>
  );
}

// The exercise's "what it works" text (exercises.why), under its name. Nothing when
// the content has none for it.
function WhatItWorks({ text, colors }: { text: string | null; colors: Colors }) {
  if (!text) return null;
  return (
    <View style={styles.why}>
      <Text style={[styles.eyebrow, { color: colors.muted, marginBottom: 4 }]}>WHAT IT WORKS</Text>
      <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

// ---- the two panels ----
// Both charts share one x layout — one column per session, same gutter — so a
// session, a block marker and the tap crosshair line up across them. The line
// zooms to its own range; the bars grow from a true zero. Values live on the y
// axis ticks and in the readout (and every session is listed below the charts),
// so no value is ever only reachable by tapping.
const W = 320;
const PAD_L = 34; // y-axis tick gutter
const PAD_R = 10;
const LAYOUT = {
  line: { h: 118, top: 16, bottom: 6 }, // top band holds the block labels
  bar: { h: 96, top: 6, bottom: 18 }, // bottom band holds the date labels
};

function LiftChart({
  kind,
  s,
  sel,
  onPick,
  colors,
  label,
}: {
  kind: "line" | "bar";
  s: LiftPoint[];
  sel: number;
  onPick: (i: number) => void;
  colors: Colors;
  label: string;
}) {
  const { h: H, top, bottom } = LAYOUT[kind];
  const vals = s.map((x) => (kind === "line" ? x.top : x.vol));
  const scale = kind === "line" ? niceScale(Math.min(...vals), Math.max(...vals)) : niceScale(0, Math.max(...vals), { zero: true });
  const n = s.length;
  const iw = W - PAD_L - PAD_R;
  const ih = H - top - bottom;
  const slot = iw / n;
  const X = (i: number) => PAD_L + slot * (i + 0.5);
  const Y = (v: number) => top + ih * (1 - (v - scale.min) / (scale.max - scale.min || 1));
  const runs = blockRuns(s);
  const boundaryX = (start: number) => PAD_L + slot * start;
  // Dots only while there's clear room between them. Crowded, each dot's surface
  // ring cuts the line and it reads as dashed — so past that the line carries it,
  // with the picked session still marked.
  const showDots = slot >= 24;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityRole="image" accessibilityLabel={label}>
      {/* y axis: hairline gridlines at clean values, labelled in the gutter */}
      {scale.ticks.map((t) => (
        <React.Fragment key={t}>
          <Line x1={PAD_L} x2={W - PAD_R} y1={Y(t)} y2={Y(t)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={PAD_L - 6} y={Y(t) + 3} fontSize={9} fill={colors.muted} textAnchor="end">
            {formatTick(t)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* block markers: a solid hairline where each new block starts */}
      {runs.slice(1).map((r) => (
        <Line
          key={`b${r.block}-${r.start}`}
          x1={boundaryX(r.start)}
          x2={boundaryX(r.start)}
          y1={kind === "line" ? 2 : top}
          y2={H - bottom}
          stroke={colors.muted}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
      ))}
      {kind === "line" && runs.length > 1
        ? runs.map((r) => {
            const width = slot * (r.end - r.start + 1);
            const text = width >= 38 ? `Block ${r.block}` : width >= 18 ? `B${r.block}` : "";
            return text ? (
              <SvgText key={`l${r.block}-${r.start}`} x={boundaryX(r.start) + 3} y={10} fontSize={9} fill={colors.muted}>
                {text}
              </SvgText>
            ) : null;
          })
        : null}

      {/* the picked session */}
      <Line x1={X(sel)} x2={X(sel)} y1={top} y2={H - bottom} stroke={colors.ink2} strokeOpacity={0.35} strokeWidth={1} />

      {kind === "line" ? (
        <>
          <Polyline
            points={vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}
            stroke={colors.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          {vals.map((v, i) =>
            showDots || i === sel ? (
              <Circle key={i} cx={X(i)} cy={Y(v)} r={i === sel ? 5 : 4} fill={colors.accent} stroke={colors.sunken} strokeWidth={2} />
            ) : null
          )}
        </>
      ) : (
        vals.map((v, i) => {
          const bw = Math.max(1, Math.min(16, slot - 2)); // capped, with a 2px gap between neighbours
          const x = X(i) - bw / 2;
          const base = H - bottom;
          const y = Math.min(Y(v), base - 1);
          const r = Math.min(4, bw / 2, base - y); // rounded data end, square at the baseline
          const d = `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`;
          // Full strength for every bar: the default orange is already under 3:1 on
          // this surface, so the picked one is marked by the crosshair, not by fading
          // the rest.
          return <Path key={i} d={d} fill={colors.accent} />;
        })
      )}

      {/* x axis: the first and last session's dates, under the lower chart only —
          centred under their sessions, held back from the edges so they never clip */}
      {kind === "bar"
        ? [0, n - 1].map((i) => (
            <SvgText key={`d${i}`} x={Math.min(W - 16, Math.max(16, X(i)))} y={H - 5} fontSize={9} fill={colors.muted} textAnchor="middle">
              {fmtDate(s[i].date)}
            </SvgText>
          ))
        : null}

      {/* tap targets: a full column per session, wider than any mark */}
      {s.map((_, i) => (
        <Rect key={`hit${i}`} x={PAD_L + slot * i} y={0} width={slot} height={H} fill="transparent" onPress={() => onPick(i)} />
      ))}
    </Svg>
  );
}

// The prototype's #liftRead readout, word for word.
function Readout({ x, u, colors }: { x: LiftPoint; u: string; colors: Colors }) {
  const b = { color: colors.ink, fontFamily: fonts.monoBold };
  const feel = { easy: "easy", right: "about right", hard: "hard" }[x.feel];
  return (
    <View style={[styles.readout, { backgroundColor: colors.raised }]}>
      <Text style={{ color: colors.ink2, fontSize: 12.5, lineHeight: 18 }}>
        {fmtDate(x.date)} · week {x.week} — <Text style={b}>{x.top} {u}</Text> × {x.sets} sets of {x.reps} ·{" "}
        <Text style={b}>{Math.round(x.vol).toLocaleString()}</Text> {u} of work{feel ? ` · felt ${feel}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, letterSpacing: 0.5, marginBottom: 8 },
  lede: { fontSize: 14, lineHeight: 20 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  why: { marginBottom: spacing.md },
  chartCard: { borderRadius: 12, padding: 14, marginTop: spacing.md },
  panelT: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginBottom: 2 },
  panelS: { fontSize: 12, marginBottom: 4 },
  panelRule: { borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  readout: { marginTop: 14, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 11 },
  flagBanner: { borderRadius: 12, padding: 12, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  rowK: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  rowNote: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  volBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 2 },
  note: { fontSize: 12, lineHeight: 17 },
});
