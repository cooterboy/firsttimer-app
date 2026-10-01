import React, { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Share, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, radius, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { WALK_HURT, WALK_KINDS, WALK_MINS, walkCue, walkKindLabel } from "../lib/walkProgram";
import { movedDaysThisWeek, newWalkEntry, trainedToday, walksOn, walkFinishCopy } from "../lib/sessionEngine";
import { WalkKind } from "../lib/types";
import CelebrateRing from "../components/workout/CelebrateRing";
import FadeSwitch from "../components/workout/FadeSwitch";

type Phase = "setup" | "timer" | "finish";
type Result = { big: string; line: string; minutes: number; moved: number; totalMin: number };

export default function WalkScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const appState = useAppState();
  const lastWalk = appState.walks[appState.walks.length - 1];

  const [kind, setKind] = useState<WalkKind>(lastWalk?.kind || "walk");
  const [minutes, setMinutes] = useState<number>(lastWalk?.minutes || 20);
  const [phase, setPhase] = useState<Phase>("setup");
  const [leftMs, setLeftMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [, forceTick] = useState(0);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [feel, setFeel] = useState<"" | "easy" | "right" | "hard">("");
  const [hurt, setHurt] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const buzzedHalfRef = useRef(false);
  const endRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      clearTick();
      return;
    }
    setPhase("setup");
    setKind(lastWalk?.kind || "walk");
    setMinutes(lastWalk?.minutes || 20);
    setRunning(false);
    setEntryId(null);
    setFeel("");
    setHurt([]);
    setResult(null);
    buzzedHalfRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => clearTick, []);

  if (!visible) return null;

  const finishWalk = (mins: number, wasAlready: boolean) => {
    clearTick();
    setRunning(false);
    const lifted = trainedToday(appState.history);
    const entry = newWalkEntry(kind, mins);
    const copy = walkFinishCopy([...appState.walks, entry], entry, lifted);
    appState.commitWalk(entry);
    setEntryId(entry.id);
    setResult({
      ...copy,
      minutes: mins,
      moved: movedDaysThisWeek([...appState.walks, entry]),
      totalMin: appState.walks.reduce((a, w) => a + (w.minutes || 0), 0) + mins,
    });
    setPhase("finish");
    if (!wasAlready) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  // Resumes from wherever it was paused (unlike mobility's per-stretch restart quirk) —
  // `fromMs` lets Resume continue the same countdown instead of starting over.
  const startTimer = (fromMs: number) => {
    clearTick();
    endRef.current = Date.now() + fromMs;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      forceTick((x) => x + 1);
      const left = Math.max(0, endRef.current - Date.now());
      setLeftMs(left);
      const totalMs = minutes * 60000;
      const pct = Math.min(1, Math.max(0, 1 - left / totalMs));
      if (!buzzedHalfRef.current && pct >= 0.5 && minutes >= 10) {
        buzzedHalfRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (left <= 0) {
        clearTick();
        setRunning(false);
        finishWalk(minutes, false);
      }
    }, 250);
  };

  const goStart = () => {
    const totalMs = minutes * 60000;
    setLeftMs(totalMs);
    setPhase("timer");
    startTimer(totalMs);
  };

  const togglePause = () => {
    if (running) {
      clearTick();
      setRunning(false);
      return;
    }
    startTimer(leftMs);
  };

  const finishNow = () => {
    const gone = minutes * 60000 - leftMs;
    finishWalk(Math.max(1, Math.round(gone / 60000)), false);
  };

  const setFeelTap = (f: "easy" | "right" | "hard") => {
    setFeel(f);
    Haptics.selectionAsync().catch(() => {});
    if (entryId) appState.updateWalkEntry(entryId, { feel: f });
  };
  const toggleHurtTap = (h: string | null) => {
    const next = h === null ? [] : hurt.includes(h) ? hurt.filter((x) => x !== h) : [...hurt, h];
    setHurt(next);
    Haptics.selectionAsync().catch(() => {});
    if (entryId) appState.updateWalkEntry(entryId, { hurt: next });
  };

  if (phase === "finish" && result) {
    const kindLower = walkKindLabel(kind).toLowerCase();
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        {/* Own provider: a Modal is a separate native view tree, so the app root's SafeAreaProvider isn't above this SafeAreaView — without one it can read 0 insets and sit under the status bar (see MobilityScreen). */}
        <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
          <ScrollView contentContainerStyle={styles.finishBody}>
            <CelebrateRing />
            <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>{result.big}</Text>
            <Text style={[styles.line, { color: colors.ink2 }]}>{result.line}</Text>
            <View style={styles.statsRow}>
              <Stat n={result.minutes} label={`Minute${result.minutes === 1 ? "" : "s"}`} />
              <Stat n={result.moved} label={`Day${result.moved === 1 ? "" : "s"} this week`} />
              <Stat n={result.totalMin} label={`Minute${result.totalMin === 1 ? "" : "s"} total`} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }]}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>HOW DID THAT FEEL?</Text>
              <View style={styles.feelRow}>
                {(["easy", "right", "hard"] as const).map((f) => {
                  const on = feel === f;
                  return (
                    <TouchableOpacity activeOpacity={0.7}
                      key={f}
                      onPress={() => setFeelTap(f)}
                      style={[
                        styles.feelBtn,
                        { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised },
                      ]}
                    >
                      <Text style={{ color: on ? colors.paper : colors.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                        {{ easy: "Easy", right: "About right", hard: "Hard" }[f]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 18 }]}>ANYTHING HURT?</Text>
              <View style={styles.pillWrap}>
                <TouchableOpacity activeOpacity={0.7}
                  onPress={() => toggleHurtTap(null)}
                  style={[styles.pill, { borderColor: hurt.length === 0 ? colors.ink : colors.line, backgroundColor: hurt.length === 0 ? colors.ink : colors.sunken }]}
                >
                  <Text style={{ color: hurt.length === 0 ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>Nothing</Text>
                </TouchableOpacity>
                {WALK_HURT.map((h) => {
                  const on = hurt.includes(h);
                  return (
                    <TouchableOpacity activeOpacity={0.7}
                      key={h}
                      onPress={() => toggleHurtTap(h)}
                      style={[styles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.sunken }]}
                    >
                      <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{h}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>
                Tag it twice and the app will say something about it. Sore is normal; sharp or one-sided isn't.
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.ink }]} onPress={onClose}>
              <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}
              style={[styles.ghost]}
              onPress={() =>
                Share.share({
                  message: `${result.minutes} minute ${kindLower} in the books. Showing up on the days between. #firsttimer`,
                }).catch(() => {})
              }
            >
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Share this</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    );
  }

  if (phase === "timer") {
    const totalMs = minutes * 60000;
    const left = Math.max(0, Math.ceil(leftMs / 1000));
    const pct = Math.min(1, Math.max(0, 1 - leftMs / totalMs));
    const cue = walkCue(pct, kind);
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        {/* Own provider: a Modal is a separate native view tree, so the app root's SafeAreaProvider isn't above this SafeAreaView — without one it can read 0 insets and sit under the status bar (see MobilityScreen). */}
        <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
          <View style={styles.topBar}>
            <Text style={[styles.topLabel, { color: colors.muted, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
              {walkKindLabel(kind)} · {minutes} min
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose}>
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Exit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <FadeSwitch id={phase}>
              <View style={[styles.video, { backgroundColor: colors.ink }]}>
                <Text style={[styles.videoTitle, { color: colors.paper, fontFamily: fonts.display }]}>{walkKindLabel(kind)}</Text>
                <Text style={[styles.videoSub, { color: colors.paper }]}>keep it easy</Text>
              </View>

              <View style={[styles.timerRow, { backgroundColor: colors.ink }]}>
                <View>
                  <Text style={[styles.timerTime, { color: colors.paper, fontFamily: fonts.display }]}>
                    {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                  </Text>
                  <Text style={[styles.timerLabel, { color: colors.paper }]}>{walkKindLabel(kind)}</Text>
                </View>
                <View style={[styles.bar, { backgroundColor: "rgba(140,140,140,.35)" }]}>
                  <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <TouchableOpacity activeOpacity={0.7} onPress={togglePause}>
                  <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 13 }}>{running ? "Pause" : "Resume"}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.cue, { color: colors.ink2, textAlign: "center" }]}>{cue}</Text>

              <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.accent }]} onPress={finishNow}>
                <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Finish</Text>
              </TouchableOpacity>
              <Text style={[styles.note, { color: colors.muted, textAlign: "center" }]}>
                Put your phone away — it keeps counting, and it'll buzz at the turnaround.
              </Text>
            </FadeSwitch>
          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    );
  }

  const doneToday = walksOn(appState.walks, new Date());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {/* Own provider: a Modal is a separate native view tree, so the app root's SafeAreaProvider isn't above this SafeAreaView — without one it can read 0 insets and sit under the status bar (see MobilityScreen). */}
      <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
        <View style={styles.topBar}>
          <Text style={[styles.topLabel, { color: colors.muted, fontFamily: fonts.bodyBold }]}>Move today</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={onClose}>
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Exit</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.video, { backgroundColor: colors.ink }]}>
            <Text style={[styles.videoTitle, { color: colors.paper, fontFamily: fonts.display }]}>{walkKindLabel(kind)}</Text>
            <Text style={[styles.videoSub, { color: colors.paper }]}>{minutes} minutes</Text>
          </View>

          <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.display }]}>Get outside.</Text>
          <Text style={[styles.cue, { color: colors.ink2 }]}>
            Any day, training or not. Easy enough to hold a conversation the whole way.
          </Text>

          {doneToday.length ? (
            <View style={[styles.banner, { backgroundColor: colors.sunken }]}>
              <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 17 }}>
                <Text style={{ fontFamily: fonts.bodyBold }}>Already logged today: </Text>
                {doneToday.map((w) => `${w.minutes} min ${walkKindLabel(w.kind).toLowerCase()}`).join(" · ")}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: spacing.lg }]}>WHAT ARE YOU DOING?</Text>
          <View style={styles.pillWrap}>
            {WALK_KINDS.map((k) => {
              const on = kind === k.k;
              return (
                <TouchableOpacity activeOpacity={0.7}
                  key={k.k}
                  onPress={() => setKind(k.k)}
                  style={[styles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised }]}
                >
                  <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{k.l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: spacing.lg }]}>HOW LONG</Text>
          <View style={styles.segRow}>
            {WALK_MINS.map((m) => {
              const on = minutes === m;
              return (
                <TouchableOpacity activeOpacity={0.7}
                  key={m}
                  onPress={() => setMinutes(m)}
                  style={[styles.segBtn, { backgroundColor: on ? colors.ink : colors.sunken }]}
                >
                  <Text style={{ color: on ? colors.paper : colors.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.accent }]} onPress={goStart}>
            <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Start {minutes} minutes</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.ghost} onPress={() => finishWalk(minutes, true)}>
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>I already did it</Text>
          </TouchableOpacity>
          <Text style={[styles.note, { color: colors.muted, textAlign: "center" }]}>
            Walking counts. It's logged on its own and never touches your session streak.
          </Text>
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, { color: colors.accent, fontFamily: fonts.display }]}>{n.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  topLabel: { flex: 1, textAlign: "center", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  video: { aspectRatio: 4 / 5, maxHeight: 200, width: "100%", borderRadius: radius, alignItems: "center", justifyContent: "center", gap: 8 },
  videoTitle: { fontSize: 22, letterSpacing: 0.5 },
  videoSub: { fontSize: 12, opacity: 0.6 },
  name: { fontSize: 28, letterSpacing: 0.5, marginTop: 16 },
  cue: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  banner: { borderRadius: 10, padding: 12, marginTop: 14 },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  segRow: { flexDirection: "row", gap: 8 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: "center" },
  primary: { borderRadius: 13, padding: 16, alignItems: "center", marginTop: spacing.lg, width: "100%" },
  ghost: { borderRadius: 13, padding: 13, alignItems: "center", marginTop: 8 },
  note: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  timerRow: { marginTop: 16, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  timerTime: { fontSize: 22, lineHeight: 22 },
  timerLabel: { fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  finishBody: { padding: spacing.lg, paddingVertical: 40, alignItems: "center" },
  big: { fontSize: 34, letterSpacing: 0.5, marginBottom: 8, textAlign: "center" },
  line: { fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 280, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 22, marginBottom: 20 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 26, lineHeight: 26 },
  statLabel: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: 4, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, width: "100%", marginBottom: 6 },
  feelRow: { flexDirection: "row", gap: 8 },
  feelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
});
