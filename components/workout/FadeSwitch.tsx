import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

// Wraps a session screen's per-step content (a movement, a stretch, a phase) so
// advancing to the next one gets a quick fade + settle instead of a hard cut —
// the session flow was the one place in the app with zero transition between
// screens. Doesn't remount `children`; just replays the animation whenever `id`
// changes, so any state inside keeps working exactly as it did before.
export default function FadeSwitch({ id, children }: { id: string | number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
