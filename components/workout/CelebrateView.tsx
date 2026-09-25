import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, spacing } from "../../lib/theme";
import { FinishCopy } from "../../lib/sessionEngine";

function CountUpNumber({ to, color }: { to: number; color: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!(to > 0)) {
      setV(0);
      return;
    }
    let raf: number;
    const t0 = Date.now();
    const dur = 700;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <Text style={[styles.statNum, { color, fontFamily: fonts.display }]}>{v}</Text>;
}

export default function CelebrateView({
  fc,
  nMoves,
  minutes,
  moved,
  ups,
  unit,
  blockDone,
  onSeeResults,
  onShare,
  onDone,
}: {
  fc: FinishCopy;
  nMoves: number;
  minutes: number;
  moved: number;
  ups: number;
  unit: string;
  blockDone: boolean;
  onSeeResults: () => void;
  onShare: () => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, { borderColor: colors.good }]}>
        <Text style={[styles.check, { color: colors.good }]}>✓</Text>
      </View>
      <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>{fc.big}</Text>
      <Text style={[styles.line, { color: colors.ink2 }]}>{fc.line}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <CountUpNumber to={nMoves} color={colors.accent} />
          <Text style={[styles.statLabel, { color: colors.muted }]}>Movement{nMoves === 1 ? "" : "s"}</Text>
        </View>
        <View style={styles.stat}>
          <CountUpNumber to={minutes} color={colors.accent} />
          <Text style={[styles.statLabel, { color: colors.muted }]}>Minute{minutes === 1 ? "" : "s"}</Text>
        </View>
        {moved ? (
          <View style={styles.stat}>
            <CountUpNumber to={moved} color={colors.accent} />
            <Text style={[styles.statLabel, { color: colors.muted }]}>{unit} moved</Text>
          </View>
        ) : null}
        {ups ? (
          <View style={styles.stat}>
            <CountUpNumber to={ups} color={colors.accent} />
            <Text style={[styles.statLabel, { color: colors.muted }]}>Went up</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.acts}>
        <TouchableOpacity style={[styles.primary, { backgroundColor: colors.accent }]} onPress={onSeeResults}>
          <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>See your results</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryDark, { backgroundColor: colors.ink }]} onPress={onShare}>
          <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Share this session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghost} onPress={onDone}>
          <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
            {blockDone ? "See what you built" : "Done for today"}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.note, { color: colors.muted }]}>
        Rate it, add a photo, and see what's next under results.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 24, alignItems: "center", minHeight: 500, justifyContent: "center" },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  check: { fontSize: 38 },
  big: { fontSize: 38, letterSpacing: 0.5, marginBottom: 8, textAlign: "center" },
  line: { fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 280, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 26, marginBottom: 24 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 30, lineHeight: 30 },
  statLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: 4 },
  acts: { width: "100%", gap: spacing.sm },
  primary: { borderRadius: 13, padding: 16, alignItems: "center" },
  primaryDark: { borderRadius: 13, padding: 16, alignItems: "center" },
  ghost: { borderRadius: 13, padding: 13, alignItems: "center" },
  note: { fontSize: 12, textAlign: "center", marginTop: 10 },
});
