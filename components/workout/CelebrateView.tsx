import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, spacing } from "../../lib/theme";
import { FinishCopy } from "../../lib/sessionEngine";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_R = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function formatCount(v: number) {
  return Math.round(v).toLocaleString();
}

function CountUpNumber({ to, color, start }: { to: number; color: string; start: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start || !(to > 0)) return;
    let raf: number;
    const t0 = Date.now();
    const dur = 700;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(to * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setV(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, to]);
  return <Text style={[styles.statNum, { color, fontFamily: fonts.display }]}>{formatCount(v)}</Text>;
}

// Fade up + in, matching the prototype's opacity/translateY reveal.
function Reveal({
  anim,
  delay,
  duration = 500,
  distance = 10,
  children,
  style,
}: {
  anim: Animated.Value;
  delay: number;
  duration?: number;
  distance?: number;
  children: React.ReactNode;
  style?: any;
}) {
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration, delay, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
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

  const entranceAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const bigAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const actsAnim = useRef(new Animated.Value(0)).current;
  const [statsStarted, setStatsStarted] = useState(false);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // The ring container pops in first — a scale+fade that's unmistakably motion —
    // then the stroke sweeps around it, then the checkmark springs in with a little
    // overshoot. Three distinct beats instead of one flat fade.
    Animated.spring(entranceAnim, { toValue: 1, friction: 6, tension: 55, delay: 60, useNativeDriver: true }).start();
    Animated.timing(ringAnim, {
      toValue: 1,
      duration: 1100,
      delay: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.spring(checkAnim, { toValue: 1, friction: 5, tension: 140, delay: 750, useNativeDriver: true }).start();
    const t = setTimeout(() => setStatsStarted(true), 880);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strokeDashoffset = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ringBox,
          {
            opacity: entranceAnim,
            transform: [{ scale: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          },
        ]}
      >
        <Svg width={112} height={112} viewBox="0 0 120 120" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={60} cy={60} r={RING_R} stroke={colors.line} strokeWidth={7} fill="none" />
          <AnimatedCircle
            cx={60}
            cy={60}
            r={RING_R}
            stroke={colors.good}
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>
        <Animated.View
          style={[
            styles.checkWrap,
            {
              opacity: checkAnim,
              transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}
        >
          <Text style={[styles.check, { color: colors.good }]}>✓</Text>
        </Animated.View>
      </Animated.View>

      <Reveal anim={bigAnim} delay={500}>
        <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>{fc.big}</Text>
      </Reveal>
      <Reveal anim={lineAnim} delay={680}>
        <Text style={[styles.line, { color: colors.ink2 }]}>{fc.line}</Text>
      </Reveal>

      <Reveal anim={statsAnim} delay={860} style={styles.statsRow}>
        <>
          <View style={styles.stat}>
            <CountUpNumber to={nMoves} color={colors.accent} start={statsStarted} />
            <Text style={[styles.statLabel, { color: colors.muted }]}>Movement{nMoves === 1 ? "" : "s"}</Text>
          </View>
          <View style={styles.stat}>
            <CountUpNumber to={minutes} color={colors.accent} start={statsStarted} />
            <Text style={[styles.statLabel, { color: colors.muted }]}>Minute{minutes === 1 ? "" : "s"}</Text>
          </View>
          {moved ? (
            <View style={styles.stat}>
              <CountUpNumber to={moved} color={colors.accent} start={statsStarted} />
              <Text style={[styles.statLabel, { color: colors.muted }]}>{unit} moved</Text>
            </View>
          ) : null}
          {ups ? (
            <View style={styles.stat}>
              <CountUpNumber to={ups} color={colors.accent} start={statsStarted} />
              <Text style={[styles.statLabel, { color: colors.muted }]}>Went up</Text>
            </View>
          ) : null}
        </>
      </Reveal>

      <Reveal anim={actsAnim} delay={1040} style={styles.acts}>
        <>
          <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.accent }]} onPress={onSeeResults}>
            <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>See your results</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={[styles.primaryDark, { backgroundColor: colors.ink }]} onPress={onShare}>
            <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Share this session</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.ghost} onPress={onDone}>
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
              {blockDone ? "See what you built" : "Done for today"}
            </Text>
          </TouchableOpacity>
        </>
      </Reveal>
      <Text style={[styles.note, { color: colors.muted }]}>
        Rate it, add a photo, and see what's next under results.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 24, alignItems: "center", minHeight: 500, justifyContent: "center" },
  ringBox: { width: 112, height: 112, marginBottom: 18, alignItems: "center", justifyContent: "center" },
  checkWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
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
