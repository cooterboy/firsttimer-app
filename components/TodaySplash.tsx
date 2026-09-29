import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { OpenerCopy, WeekRecap, fmtDate } from "../lib/sessionEngine";
import { unit } from "../lib/gymProgram";

// Ports the prototype's showOpener() (spec/prototype.html:1445-1464) — a full-screen
// card once per day, auto-dismissing after 2.4s or on tap.
export function DailyOpenerSplash({
  visible,
  name,
  copy,
  onClose,
}: {
  visible: boolean;
  name: string;
  copy: OpenerCopy;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.paper }]} onPress={onClose}>
        <Animated.View style={[styles.content, { opacity: fade }]}>
          <Text style={[styles.mark, { color: colors.ink, fontFamily: fonts.display }]}>
            FIRST <Text style={{ color: colors.accent }}>TIMER</Text>
          </Text>
          <Text style={[styles.greet, { color: colors.muted }]}>
            {greet}
            {name ? `, ${name}` : ""}.
          </Text>
          <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>{copy.big}</Text>
          <Text style={[styles.sub, { color: colors.ink2 }]}>{copy.sub}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Ports the prototype's showWeekRecap() (spec/prototype.html:1474-1502) — shown once
// per completed week, ahead of the daily opener if both are eligible the same day.
export function WeekRecapSplash({
  visible,
  recap,
  units,
  onStartWeek,
  onSeeNumbers,
}: {
  visible: boolean;
  recap: WeekRecap;
  units: "imperial" | "metric";
  onStartWeek: () => void;
  onSeeNumbers: () => void;
}) {
  const { colors } = useTheme();
  const u = unit(units);
  const hit = recap.sessions >= recap.target;
  const head = hit ? "Every session. Done." : recap.sessions ? `${recap.sessions} of ${recap.target}.` : "You still showed up.";
  const sub = hit
    ? "That's the week the whole program is built on."
    : recap.sessions
    ? "The ones you missed aren't gone. They're just next."
    : "Not a lifting week, and it still counts for more than nothing.";
  const movedLabel = recap.moved >= 1000 ? `${(recap.moved / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(recap.moved);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStartWeek}>
      <View style={[styles.backdrop, { backgroundColor: colors.paper }]}>
        <View style={styles.content}>
          <Text style={[styles.mark, { color: colors.ink, fontFamily: fonts.display }]}>
            LAST <Text style={{ color: colors.accent }}>WEEK</Text>
          </Text>
          <Text style={[styles.greet, { color: colors.muted }]}>Week of {fmtDate(new Date(recap.start).toISOString())}</Text>
          <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display, fontSize: 32 }]}>{head}</Text>
          <Text style={[styles.sub, { color: colors.ink2 }]}>{sub}</Text>

          <View style={styles.tiles}>
            <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
              <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{recap.activeDays}</Text>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Days moving</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
              <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{movedLabel}</Text>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>{u} moved</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
              <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{recap.ups.length}</Text>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Lifts up</Text>
            </View>
          </View>

          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onStartWeek}>
            <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Start the week</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onSeeNumbers}>
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>See the numbers</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  content: { width: "100%", maxWidth: 340, alignItems: "flex-start" },
  mark: { fontSize: 20, letterSpacing: 1, marginBottom: 18 },
  greet: { fontSize: 14, marginBottom: 8 },
  big: { fontSize: 40, letterSpacing: 0.5, lineHeight: 42, marginBottom: 10 },
  sub: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
  tiles: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 20 },
  tile: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  tileNum: { fontSize: 24, marginBottom: 2 },
  tileLabel: { fontSize: 11, textAlign: "center" },
  primaryBtn: { width: "100%", borderRadius: 13, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
  ghostBtn: { width: "100%", alignItems: "center", paddingVertical: 6 },
});
