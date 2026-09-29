import * as ExpoHaptics from "expo-haptics";

// Drop-in gated shim for expo-haptics — same call sites everywhere, but every
// call becomes a no-op when the user turns off Settings > Haptics. Mirrors the
// prototype's buzz(), which checks state.settings.haptics before vibrating
// (spec/prototype.html:1158). appState.tsx calls setHapticsEnabled() whenever
// settings.haptics changes, so this stays in sync without threading the
// setting through every screen that fires a haptic.
let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export function selectionAsync() {
  if (!enabled) return Promise.resolve();
  return ExpoHaptics.selectionAsync();
}

export function notificationAsync(type?: ExpoHaptics.NotificationFeedbackType) {
  if (!enabled) return Promise.resolve();
  return ExpoHaptics.notificationAsync(type);
}

export function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle) {
  if (!enabled) return Promise.resolve();
  return ExpoHaptics.impactAsync(style);
}
