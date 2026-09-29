import { createAudioPlayer } from "expo-audio";

// Ports the prototype's beep() — an 880Hz tone on rest-timer-end and session/
// mobility/walk celebrations (spec/prototype.html:1157, called at lines 2075,
// 2101, 2156, 2436, 2488, 2524, 2554). Gated the same way: state.settings.sounds.
// appState.tsx calls setSoundsEnabled() whenever settings.sounds changes.
let enabled = true;
let player: ReturnType<typeof createAudioPlayer> | null = null;

function getPlayer() {
  if (!player) player = createAudioPlayer(require("../assets/sounds/beep.wav"));
  return player;
}

export function setSoundsEnabled(v: boolean) {
  enabled = v;
}

export async function playBeep() {
  if (!enabled) return;
  try {
    const p = getPlayer();
    await p.seekTo(0);
    p.play();
  } catch {
    // best-effort — a missing/failed audio device shouldn't break the workout flow
  }
}
