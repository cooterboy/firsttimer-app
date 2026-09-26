import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_R = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

// The same three-beat animation as the workout's celebrate screen: the ring container
// pops in (scale+fade), the stroke sweeps around it, then the checkmark springs in
// with a little overshoot — shared here so the mobility and walk finish screens feel
// the same without duplicating the tuning.
export default function CelebrateRing() {
  const { colors } = useTheme();
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(entranceAnim, { toValue: 1, friction: 6, tension: 55, delay: 60, useNativeDriver: true }).start();
    Animated.timing(ringAnim, {
      toValue: 1,
      duration: 1100,
      delay: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.spring(checkAnim, { toValue: 1, friction: 5, tension: 140, delay: 750, useNativeDriver: true }).start();
  }, []);

  const strokeDashoffset = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [RING_CIRCUMFERENCE, 0] });

  return (
    <Animated.View
      style={[
        styles.ringBox,
        { opacity: entranceAnim, transform: [{ scale: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
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
          { opacity: checkAnim, transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
        ]}
      >
        <Text style={[styles.check, { color: colors.good }]}>✓</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ringBox: { width: 112, height: 112, marginBottom: 18, alignItems: "center", justifyContent: "center" },
  checkWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  check: { fontSize: 38 },
});
