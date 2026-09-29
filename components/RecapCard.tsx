import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { unit } from "../lib/gymProgram";
import { WeekRecap } from "../lib/sessionEngine";
import Card from "./Card";

// Ports the prototype's recapCard() (spec/prototype.html:2332-2345) — an ongoing
// "this week" / "last week" summary card, distinct from the one-time WeekRecapSplash
// (TodaySplash.tsx). Appears in the Today tab nudge area (Sunday, or Monday before
// the first session) and in Progress > Overview (both weeks, always).
export default function RecapCard({
  recap,
  label,
  units,
}: {
  recap: WeekRecap;
  label: string;
  units: "imperial" | "metric";
}) {
  const { colors } = useTheme();
  if (!recap.sessions && !recap.mobility && !recap.walks) return null;

  const hit = recap.sessions >= recap.target;
  const line = hit
    ? "Every planned session done."
    : recap.sessions
    ? `${recap.sessions} of ${recap.target} sessions. The rest are still waiting, not missed.`
    : recap.mobility
    ? `${recap.mobility} mobility day${recap.mobility > 1 ? "s" : ""} in. Lifting starts again whenever you walk in.`
    : `${recap.walks} walk${recap.walks > 1 ? "s" : ""} in. Lifting starts again whenever you walk in.`;

  const movedLabel =
    recap.moved >= 1000 ? `${(recap.moved / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(recap.moved);
  const u = unit(units);

  const bits = [
    recap.sessions && recap.mobility ? `${recap.mobility} mobility day${recap.mobility > 1 ? "s" : ""}` : "",
    recap.walks ? `${recap.walks} walk${recap.walks > 1 ? "s" : ""} · ${recap.walkMin} min` : "",
    recap.minutes ? `${recap.minutes} min training` : "",
    recap.topTag ? `most tagged: "${recap.topTag}"` : "",
  ].filter(Boolean);
  const note = bits.length ? bits.join(" · ") : recap.sessions ? "Tag and rate sessions and this fills in." : "";

  return (
    <Card style={styles.card}>
      <View style={styles.rowTop}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{label}</Text>
        <View style={[styles.badge, { backgroundColor: hit ? colors.goodSoft : colors.sunken }]}>
          <Text style={{ color: hit ? colors.good : colors.muted, fontSize: 10.5, fontFamily: fonts.bodyBold }}>
            {recap.sessions}/{recap.target}
          </Text>
        </View>
      </View>

      <Text style={[styles.line, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{line}</Text>

      {recap.sessions ? (
        <View style={styles.tiles}>
          <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
            <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{movedLabel}</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{u} moved</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
            <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{recap.ups.length}</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Lifts up</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
            <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{recap.avg || "—"}</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Avg rating</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.note, { color: colors.muted }]}>
          {recap.activeDays ? `You still moved on ${recap.activeDays} day${recap.activeDays === 1 ? "" : "s"}. ` : ""}
          This fills in with weight moved, lifts that went up, and how the sessions felt, from your first session
          this week.
        </Text>
      )}

      {recap.ups.length ? <Text style={[styles.ups, { color: colors.ink2 }]}>{recap.ups.join(" · ")}</Text> : null}
      {note ? <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>{note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  line: { fontSize: 16 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 12 },
  tile: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  tileNum: { fontSize: 24, marginBottom: 2 },
  tileLabel: { fontSize: 11, textAlign: "center" },
  ups: { fontSize: 12, marginTop: 10 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
