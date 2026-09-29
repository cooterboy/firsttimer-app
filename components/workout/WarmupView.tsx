import React, { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "../../lib/haptics";
import { playBeep } from "../../lib/sound";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, radius } from "../../lib/theme";
import { ActiveMove } from "../../lib/types";

const WARMUP_MS = 5 * 60 * 1000;

export default function WarmupView({
  move,
  gym,
  onDone,
}: {
  move: ActiveMove;
  gym: boolean;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(WARMUP_MS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const toggle = () => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
      return;
    }
    const end = Date.now() + left;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, end - Date.now());
      setLeft(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRunning(false);
        playBeep();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, 500);
  };

  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const pct = Math.round((1 - left / WARMUP_MS) * 100);

  return (
    <View>
      <View style={[styles.video, { backgroundColor: colors.ink }]}>
        <View style={[styles.ring, { borderColor: colors.paper }]} />
        <Text style={[styles.videoTitle, { color: colors.paper, fontFamily: fonts.display }]}>Warm-up</Text>
        <Text style={[styles.videoSub, { color: colors.paper }]}>
          {gym ? "bike or treadmill" : "march, circles, chair squats"}
        </Text>
      </View>

      <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.display }]}>Five easy minutes.</Text>
      <Text style={[styles.spec, { color: colors.muted, fontFamily: fonts.mono }]}>{move.spec}</Text>
      <Text style={[styles.cue, { color: colors.ink2 }]}>{move.cue}</Text>

      <View style={[styles.timerRow, { backgroundColor: colors.ink }]}>
        <View>
          <Text style={[styles.timerTime, { color: colors.paper, fontFamily: fonts.display }]}>
            {left <= 0 ? "Go" : `${mins}:${String(secs).padStart(2, "0")}`}
          </Text>
          <Text style={[styles.timerLabel, { color: colors.paper }]}>Warm-up</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: "rgba(140,140,140,.35)" }]}>
          <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${pct}%` }]} />
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={toggle}>
          <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 13 }}>
            {running ? "Pause" : "Start"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={onDone} style={[styles.primary, { backgroundColor: colors.accent }]}>
        <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>
          Warmed up, start session
        </Text>
      </TouchableOpacity>
      <Text style={[styles.note, { color: colors.muted }]}>You can turn the warm-up step off under Settings.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  video: {
    aspectRatio: 4 / 5,
    maxHeight: 260,
    width: "100%",
    borderRadius: radius,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, opacity: 0.5 },
  videoTitle: { fontSize: 22, letterSpacing: 0.5 },
  videoSub: { fontSize: 12, opacity: 0.6 },
  name: { fontSize: 32, letterSpacing: 0.5, marginTop: 16 },
  spec: { fontSize: 14, marginTop: 4 },
  cue: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  timerRow: { marginTop: 16, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  timerTime: { fontSize: 22, lineHeight: 22 },
  timerLabel: { fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  primary: { marginTop: 14, borderRadius: 13, padding: 16, alignItems: "center" },
  note: { fontSize: 12, textAlign: "center", marginTop: 10, lineHeight: 17 },
});
