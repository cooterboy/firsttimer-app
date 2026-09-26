import React, { useEffect, useRef } from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_R = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

// The same ring-fill-then-checkmark animation as the workout's celebrate screen,
// shared here so the mobility and walk finish screens get the same feel without
// touching that already-tested component.
export default function CelebrateRing() {
  const { colors } = useTheme();
  const ringAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(ringAnim, { toValue: 1, duration: 1000, delay: 100, useNativeDriver: false }).start();
    Animated.timing(checkAnim, { toValue: 1, duration: 450, delay: 700, useNativeDriver: true }).start();
  }, []);

  const strokeDashoffset = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [RING_CIRCUMFERENCE, 0] });

  return (
    <View style={styles.ringBox}>
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
          { opacity: checkAnim, transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
        ]}
      >
        <Text style={[styles.check, { color: colors.good }]}>✓</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringBox: { width: 112, height: 112, marginBottom: 18, alignItems: "center", justifyContent: "center" },
  checkWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  check: { fontSize: 38 },
});
