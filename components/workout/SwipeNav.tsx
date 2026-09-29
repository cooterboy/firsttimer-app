import React from "react";
import { View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "../../lib/haptics";

// One-handed movement navigation during a session (workout or mobility) — swipe left
// for next, right for previous, alongside the existing tap targets (dots, Back/Next).
// A bare React Native PanResponder version of this couldn't reliably win the gesture
// against the surrounding ScrollView's native scroll recognizer (it never claimed the
// touch at all, not even incorrectly) — react-native-gesture-handler's activeOffsetX/
// failOffsetY is the actual supported way to say "claim this gesture once it's clearly
// horizontal, otherwise let the ScrollView have it," and needs the screens using this
// to import ScrollView from react-native-gesture-handler (not react-native) so the two
// negotiate properly — see WorkoutScreen.tsx / MobilityScreen.tsx.
export default function SwipeNav({
  onSwipeLeft,
  onSwipeRight,
  style,
  children,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const gesture = Gesture.Pan()
    .activeOffsetX([-40, 40])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX <= -40 && onSwipeLeft) {
        Haptics.selectionAsync().catch(() => {});
        onSwipeLeft();
      } else if (e.translationX >= 40 && onSwipeRight) {
        Haptics.selectionAsync().catch(() => {});
        onSwipeRight();
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}
