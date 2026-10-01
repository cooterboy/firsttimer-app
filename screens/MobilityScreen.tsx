import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { playBeep } from "../lib/sound";
import { useTheme } from "../lib/ThemeContext";
import { fonts, radius, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { mobilityMinutes, mobilitySteps } from "../lib/mobilityProgram";
import { mobilityDayCounts, mobilityFinishCopy, newMobilityEntry, trainedToday } from "../lib/sessionEngine";
import CelebrateRing from "../components/workout/CelebrateRing";
import FadeSwitch from "../components/workout/FadeSwitch";
import SwipeNav from "../components/workout/SwipeNav";
import Sheet from "../components/workout/Sheet";

type Result = { logged: boolean; big: string; line: string; minutes: number; stretches: number; count: number };

export default function MobilityScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const appState = useAppState();
  const steps = useMemo(() => mobilitySteps(), []);

  const [i, setI] = useState(0);
  const [left, setLeft] = useState(steps[0].sec);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"steps" | "finish">("steps");
  const [hurtSheet, setHurtSheet] = useState(false);
  // Stretches whose hold ran all the way out — the only thing that counts as done.
  // Next, swiping and "This hurts" move on without adding to it.
  const [held, setHeld] = useState<Set<number>>(() => new Set());
  // The same set, for decisions. finish() can run from a hold timer's old callback,
  // which would see a stale `held`; this ref is always current.
  const heldRef = useRef<Set<number>>(new Set());
  const markHeld = (idx: number) => {
    heldRef.current.add(idx);
    setHeld(new Set(heldRef.current));
  };
  // The stretch on screen right now. A hold timer's callbacks are created when that
  // timer starts and keep that moment's `i`, so completion reads the position here.
  const iRef = useRef(0);
  useEffect(() => {
    iRef.current = i;
  }, [i]);
  const [result, setResult] = useState<Result | null>(null);
  const startedAtRef = useRef(Date.now());
  const endRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  // completeStep()'s 600ms "pause between stretches" delay — cancelled on close so it
  // can't fire after the modal's gone and silently spin up a new interval in the background.
  const clearAdvanceTimeout = () => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      clearTick();
      clearAdvanceTimeout();
      return;
    }
    setI(0);
    setLeft(steps[0].sec);
    setStarted(false);
    setRunning(false);
    setPhase("steps");
    setHurtSheet(false);
    setResult(null);
    heldRef.current = new Set();
    setHeld(new Set());
    startedAtRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(
    () => () => {
      clearTick();
      clearAdvanceTimeout();
    },
    []
  );

  if (!visible) return null;
  const step = steps[i];

  const finish = () => {
    if (!mobilityDayCounts(heldRef.current.size)) {
      // Nothing held: nothing saved, and no celebration.
      setResult({ logged: false, big: "", line: "", minutes: 0, stretches: 0, count: appState.mobility.length });
      setPhase("finish");
      return;
    }
    const minutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    const alsoLifted = trainedToday(appState.history);
    const entry = newMobilityEntry(minutes);
    const copy = mobilityFinishCopy([...appState.mobility, entry], minutes, alsoLifted);
    appState.commitMobility(entry);
    // Stretches actually held (including "This hurts" skips), not the total on the list.
    setResult({ ...copy, logged: true, minutes, stretches: heldRef.current.size, count: appState.mobility.length + 1 });
    setPhase("finish");
  };

  // Unlike WorkoutScreen's "Save & exit" — which works because an in-progress lifting
  // session is already persisted continuously via appState.setActive and can be
  // resumed — mobility has no such in-progress state, so there was no "save" half of
  // "Exit" at all: leaving mid-stretch silently discarded everything, no matter how
  // much was actually done. Given how short and low-stakes a mobility day is, partial
  // credit (log whatever was completed, no resume) is the simpler fix that matches:
  // logging a completed 2-minute mobility day is honest, and doesn't need a second
  // persisted "active" state living alongside appState.active. It saves only once
  // the day counts (mobilityDayCounts: a stretch held, or skipped via "This hurts"),
  // and the button only says "Save & exit" when it will.
  const hasProgress = mobilityDayCounts(held.size);
  const saveAndExit = () => {
    clearTick();
    clearAdvanceTimeout();
    if (mobilityDayCounts(heldRef.current.size)) {
      const minutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
      appState.commitMobility(newMobilityEntry(minutes));
    }
    onClose();
  };

  // Same timer restart quirk as the prototype: pausing freezes the number on screen,
  // but Resume always restarts the current stretch's full hold from the top rather
  // than continuing from where it was paused.
  const startTimer = (sec: number) => {
    clearTick();
    endRef.current = Date.now() + sec * 1000;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      const remain = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
      setLeft(remain);
      if (Date.now() >= endRef.current) {
        clearTick();
        setRunning(false);
        completeStep();
      }
    }, 250);
  };

  const completeStep = () => {
    markHeld(iRef.current);
    playBeep();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // From the current position, not `i`: this runs from a hold timer's callback,
    // which keeps the `i` from when that timer started.
    const next = iRef.current + 1;
    advanceTimeoutRef.current = setTimeout(() => {
      advanceTimeoutRef.current = null;
      if (next >= steps.length) {
        finish();
        return;
      }
      // Moves on to the next stretch but doesn't start its hold: every stretch waits
      // for its own Start press, so there's time to see the movement first. (Starting
      // it from here is also what made a stretch restart instead of advancing — the
      // new timer would inherit this old callback's stale position.)
      setI(next);
      setLeft(steps[next].sec);
      setStarted(false);
    }, 600);
  };

  const toggleGo = () => {
    if (running) {
      clearTick();
      setRunning(false);
      return;
    }
    clearAdvanceTimeout();
    setStarted(true);
    startTimer(step.sec);
  };

  const goNext = () => {
    clearTick();
    clearAdvanceTimeout();
    setRunning(false);
    const next = i + 1;
    if (next >= steps.length) {
      finish();
      return;
    }
    setI(next);
    setLeft(steps[next].sec);
    setStarted(false);
  };
  const goPrev = () => {
    if (i === 0) return;
    clearTick();
    clearAdvanceTimeout();
    setRunning(false);
    setI(i - 1);
    setLeft(steps[i - 1].sec);
    setStarted(false);
  };

  // "This hurts" → skip counts as held: stopping for pain is using the safety option
  // honestly, and treating it as incomplete would nudge people to push through pain.
  const skipHurt = () => {
    markHeld(iRef.current);
    setHurtSheet(false);
    goNext();
  };

  if (phase === "finish" && result) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
          <ScrollView contentContainerStyle={styles.finishBody}>
            {!result.logged ? (
              <>
                <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>Nothing logged.</Text>
                <Text style={[styles.line, { color: colors.ink2 }]}>Hold at least one stretch to count today as done.</Text>
                <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.ink }]} onPress={onClose}>
                  <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <CelebrateRing />
                <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>{result.big}</Text>
                <Text style={[styles.line, { color: colors.ink2 }]}>{result.line}</Text>
                <View style={styles.statsRow}>
                  {/* Held out of the whole list, so a partial day reads as one: "2 / of 17 stretches". */}
                  <Stat n={result.stretches} label={`of ${steps.length} stretches`} />
                  <Stat n={result.minutes} label={`Minute${result.minutes === 1 ? "" : "s"}`} />
                  <Stat n={result.count} label={`Mobility day${result.count === 1 ? "" : "s"}`} />
                </View>
                <Text style={[styles.note, { color: colors.muted, textAlign: "center" }]}>
                  Logged to your history, same as a session.
                </Text>
                <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.ink }]} onPress={onClose}>
                  <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  const pct = Math.round((1 - left / step.sec) * 100);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={saveAndExit}>
      {/* A Modal is its own native view tree, so the app root's SafeAreaProvider isn't
          above this SafeAreaView; without a provider it reads its insets once, before
          the modal is laid out, and keeps 0 — header under the status bar. A provider
          inside the modal re-reads them once layout happens. */}
      <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
        <View style={styles.topBar}>
          <Text style={[styles.topLabel, { color: colors.muted, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
            Mobility · {i + 1} of {steps.length}
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={saveAndExit}>
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>
              {hasProgress ? "Save & exit" : "Exit"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dots}>
          {steps.map((_, idx) => (
            <View
              key={idx}
              // Current position, then held (green), then passed-but-not-held (hollow
              // outline, so skipped reads differently by shape, not only colour), then
              // still to come.
              style={[
                styles.dot,
                idx === i
                  ? { backgroundColor: colors.accent }
                  : held.has(idx)
                    ? { backgroundColor: colors.good }
                    : idx < i
                      ? { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.muted }
                      : { backgroundColor: colors.line },
              ]}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <SwipeNav onSwipeLeft={goNext} onSwipeRight={goPrev}>
          <FadeSwitch id={i}>
            <View style={[styles.video, { backgroundColor: colors.ink }]}>
              <Text style={[styles.videoTitle, { color: colors.paper, fontFamily: fonts.display }]}>{step.n}</Text>
              <Text style={[styles.videoSub, { color: colors.paper }]}>clip · coming soon</Text>
            </View>

            <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.display }]}>{step.n}</Text>
            <Text style={[styles.spec, { color: colors.muted, fontFamily: fonts.mono }]}>{step.sec} sec</Text>
            <Text style={[styles.cue, { color: colors.ink2 }]}>{step.cue}</Text>

            <View style={[styles.timerRow, { backgroundColor: colors.ink }]}>
              <View>
                <Text style={[styles.timerTime, { color: colors.paper, fontFamily: fonts.display }]}>{left}s</Text>
                <Text style={[styles.timerLabel, { color: colors.paper }]}>Hold</Text>
              </View>
              <View style={[styles.bar, { backgroundColor: "rgba(140,140,140,.35)" }]}>
                <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${pct}%` }]} />
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={toggleGo}>
                <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                  {running ? "Pause" : started ? "Resume" : "Start"}
                </Text>
              </TouchableOpacity>
            </View>
          </FadeSwitch>
          </SwipeNav>

          <View style={styles.helperRow}>
            <TouchableOpacity activeOpacity={0.7}
              disabled={i === 0}
              onPress={goPrev}
              style={[styles.helperBtn, { borderColor: colors.line, opacity: i === 0 ? 0.4 : 1 }]}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={goNext} style={[styles.helperBtn, { borderColor: colors.line }]}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
                {i === steps.length - 1 ? "Finish" : "Next"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setHurtSheet(true)} style={[styles.helperBtn, { borderColor: colors.bad }]}>
              <Text style={{ color: colors.bad, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>This hurts</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.note, { color: colors.muted, textAlign: "center" }]}>
            About {mobilityMinutes()} minutes total. Press Start on each stretch when you're ready.
          </Text>
        </ScrollView>

        <Sheet visible={hurtSheet} onClose={() => setHurtSheet(false)}>
          <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, marginBottom: 8 }}>
            Skip it.
          </Text>
          <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
            Stretching should feel like tension, never pain. Skip this one and tell your trainer if it keeps happening.
          </Text>
          <TouchableOpacity activeOpacity={0.7} style={[styles.sheetOpt, { backgroundColor: colors.sunken }]} onPress={skipHurt}>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Skip this stretch</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={[styles.sheetOpt, { backgroundColor: colors.sunken, marginTop: 8 }]} onPress={() => setHurtSheet(false)}>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>It's fine, keep going</Text>
          </TouchableOpacity>
        </Sheet>
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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topLabel: { flex: 1, textAlign: "center", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  dots: { flexDirection: "row", gap: 5, marginTop: 10, paddingHorizontal: spacing.lg },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  video: { aspectRatio: 4 / 5, maxHeight: 220, width: "100%", borderRadius: radius, alignItems: "center", justifyContent: "center", gap: 8 },
  videoTitle: { fontSize: 20, letterSpacing: 0.5, textAlign: "center", paddingHorizontal: 20 },
  videoSub: { fontSize: 12, opacity: 0.6 },
  name: { fontSize: 28, letterSpacing: 0.5, marginTop: 16 },
  spec: { fontSize: 14, marginTop: 4 },
  cue: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  timerRow: { marginTop: 16, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  timerTime: { fontSize: 22, lineHeight: 22 },
  timerLabel: { fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  helperRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  helperBtn: { flex: 1, borderWidth: 1, borderRadius: 11, paddingVertical: 12, alignItems: "center" },
  note: { fontSize: 12, marginTop: 12, lineHeight: 17 },
  sheetOpt: { borderRadius: 12, padding: 15, alignItems: "center" },
  finishBody: { padding: spacing.lg, paddingVertical: 40, alignItems: "center", minHeight: 500, justifyContent: "center" },
  big: { fontSize: 34, letterSpacing: 0.5, marginBottom: 8, textAlign: "center" },
  line: { fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 280, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 26, marginBottom: 20 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 28, lineHeight: 28 },
  statLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: 4 },
  primary: { borderRadius: 13, padding: 16, alignItems: "center", marginTop: 14, width: "100%" },
});
