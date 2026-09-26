import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { ActiveMove, ActiveWorkout, HistoryEntry, SheetState } from "../lib/types";
import { BLOCK_SESSIONS, MovementVariant, daysPer, step as stepFor, unit as unitFor } from "../lib/gymProgram";
import {
  buildSessionForProfile,
  coachRead,
  finishCopy,
  guessStart,
  isWarmup,
  logSessionEntry,
  moveDone,
  moveNo,
  moveSummary,
  newActiveWorkout,
  nextPreview,
  nextUndone,
  applySwap as applySwapEngine,
  setFeedback,
  movedToday,
} from "../lib/sessionEngine";
import FadeSwitch from "../components/workout/FadeSwitch";
import WarmupView from "../components/workout/WarmupView";
import MovementView from "../components/workout/MovementView";
import CelebrateView from "../components/workout/CelebrateView";
import FinishView from "../components/workout/FinishView";
import Sheet from "../components/workout/Sheet";
import WorkoutSheetRouter from "../components/workout/WorkoutSheets";

// Real product rule: 15s floor so the last set of a rest period doesn't get rushed.
// Skipped in dev builds only, so testing isn't slowed down by it.
const REST_FLOOR = __DEV__ ? 0 : 15;

export default function WorkoutScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const appState = useAppState();
  const [wo, setWo] = useState<ActiveWorkout | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [rest, setRest] = useState<{ total: number; end: number } | null>(null);
  const [, forceTick] = useState(0);

  // Open a fresh session (or resume) whenever the modal opens. appState.active is the
  // source of truth for "is a session actually in progress" — it's explicitly cleared
  // when one finishes (or test data resets), so trust it instead of this screen's own
  // leftover local state, which would otherwise still match on block/idx and resume a
  // session that's already done.
  useEffect(() => {
    if (!visible) return;
    if (appState.active && appState.active.block === appState.block && appState.active.idx === appState.session) {
      setWo(appState.active);
    } else {
      const built = buildSessionForProfile(appState.block, appState.session, appState.profile);
      const fresh = newActiveWorkout(built, appState.profile, appState.settings, appState.history);
      appState.setActive(fresh);
      setWo(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Rest timer tick.
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => {
      forceTick((x) => x + 1);
      if (Date.now() >= rest.end) {
        setRest(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, 250);
    return () => clearInterval(id);
  }, [rest]);

  // Log the session to history exactly once, the moment every movement is done or skipped.
  useEffect(() => {
    if (!wo || wo.logged || wo.mi < wo.moves.length) return;
    const entry = logSessionEntry(wo);
    const historyWithEntry = [...appState.history, entry];
    const real = wo.moves.filter((m) => !isWarmup(m));
    const blockDone = appState.session + 1 >= BLOCK_SESSIONS;
    const milestone = (wo.idx + 1) % (daysPer() * 4) === 0;
    const fc = finishCopy(wo, real, blockDone, milestone, historyWithEntry, appState.profile);
    appState.commitSession(entry);
    const loggedWo = { ...wo, logged: true, fc };
    setWo(loggedWo);
    appState.setActive(loggedWo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo]);

  if (!wo) return null;

  const profile = appState.profile;
  const settings = appState.settings;
  const move = wo.mi < wo.moves.length ? wo.moves[wo.mi] : null;
  const phase: "warmup" | "movement" | "celebrate" | "finish" =
    wo.mi >= wo.moves.length ? (wo.celebrated ? "finish" : "celebrate") : isWarmup(wo.moves[wo.mi]) ? "warmup" : "movement";

  const updateWo = (next: ActiveWorkout) => {
    setWo(next);
    appState.setActive(next);
  };
  const updateMove = (i: number, patch: Partial<ActiveMove>) => {
    const moves = wo.moves.slice();
    moves[i] = { ...moves[i], ...patch };
    updateWo({ ...wo, moves });
  };
  const clearRest = () => setRest(null);
  const startRest = (sec: number) => setRest({ total: sec, end: Date.now() + sec * 1000 });

  const advance = () => {
    clearRest();
    const n = nextUndone(wo.moves, wo.mi + 1);
    updateWo({ ...wo, mi: n });
  };
  const goMove = (i: number) => {
    if (i === wo.mi || i < 0 || i >= wo.moves.length) return;
    clearRest();
    updateWo({ ...wo, mi: i });
  };

  const restState = rest
    ? (() => {
        const left = Math.max(0, Math.ceil((rest.end - Date.now()) / 1000));
        const elapsed = Math.max(0, rest.total - left);
        const hold = Math.max(0, REST_FLOOR - elapsed);
        return { total: rest.total, left, hold };
      })()
    : null;

  // ---- movement handlers ----
  const onChangeSetValue = (i: number, v: string) => {
    if (!move) return;
    const setW = move.setW.slice();
    setW[i] = v;
    const doneVals = move.done.map((idx) => Number(setW[idx])).filter((x) => x > 0);
    const w = doneVals.length ? String(Math.max(...doneVals)) : setW[0] || "";
    updateMove(wo.mi, { setW, w });
  };
  const onStepSet = (i: number, dir: 1 | -1) => {
    if (!move) return;
    const st = stepFor(profile.units);
    const cur = Number(move.setW[i]) || guessStart(move, i, profile, appState.history);
    const next = Math.max(0, Math.round((cur + dir * st) / st) * st);
    const setW = move.setW.slice();
    setW[i] = String(next);
    const doneVals = move.done.map((idx) => Number(setW[idx])).filter((x) => x > 0);
    const w = doneVals.length ? String(Math.max(...doneVals)) : setW[0] || "";
    updateMove(wo.mi, { setW, w });
  };
  const onToggleSet = (i: number) => {
    if (!move) return;
    if (move.done.includes(i)) {
      clearRest();
      updateMove(wo.mi, { done: move.done.filter((x) => x !== i), fb: null });
      return;
    }
    const done = [...move.done, i];
    const setW = move.setW.slice();
    if (move.type === "weight" && i + 1 < move.sets && !setW[i + 1]) setW[i + 1] = setW[i];
    let fb = setFeedback(move, i, wo.block, wo.idx, appState.history, profile);
    if (done.length >= move.sets) {
      const sum = moveSummary({ ...move, done, setW }, wo.block, wo.idx, appState.history);
      if (sum) fb = sum;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    updateMove(wo.mi, { done, fb, setW });
    if (done.length < move.sets && settings.autoRest) startRest(move.rest);
    else clearRest();
  };
  const onSetFeel = (feel: "easy" | "right" | "hard") => {
    Haptics.selectionAsync().catch(() => {});
    updateMove(wo.mi, { feel });
  };
  const onUnskip = () => {
    updateMove(wo.mi, { skipped: false, feel: "", done: [], fb: null });
  };
  const onOpenFindWeight = () => setSheet({ kind: "findWeight" });
  const onOpenInfo = () => setSheet({ kind: "info" });
  const onOpenSwap = (kind: "sub" | "easier") => setSheet({ kind: "swap", swapKind: kind });
  const onOpenHurt = () => setSheet({ kind: "hurt" });
  const onOpenNote = () => setSheet({ kind: "note" });
  const onOpenShortOnTime = () => setSheet({ kind: "shortOnTime" });

  const onSwap = (alt: MovementVariant, label: string) => {
    if (!move) return;
    const newMove = applySwapEngine(move, alt, label, wo.block, profile, appState.history);
    updateMove(wo.mi, newMove);
    clearRest();
    setSheet(null);
  };
  const onSkipHurt = () => {
    const moves = wo.moves.slice();
    moves[wo.mi] = { ...moves[wo.mi], skipped: true, done: [], feel: "skipped", fb: null };
    const n = nextUndone(moves, wo.mi + 1);
    clearRest();
    updateWo({ ...wo, moves, mi: n });
    setSheet(null);
  };
  const onSaveNote = (note: string, tags: string[]) => updateMove(wo.mi, { note, mtags: tags });
  const onFindWeightSave = (value: number) => {
    if (!move) return;
    const v = String(value);
    updateMove(wo.mi, { setW: Array.from({ length: move.sets }, () => v), w: v });
  };
  const onShortOnTimeConfirm = () => {
    const moves = wo.moves.map((m) => {
      if (isWarmup(m)) return m;
      const sets = Math.max(1, m.sets - 1);
      const done = m.done.filter((x) => x < sets);
      return { ...m, sets, done };
    });
    updateWo({ ...wo, moves, dropSet: true });
    setSheet(null);
  };

  const onWarmupDone = () => {
    const moves = wo.moves.slice();
    moves[0] = { ...moves[0], done: [0] };
    const n = nextUndone(moves, wo.mi + 1);
    updateWo({ ...wo, moves, mi: n });
  };

  const closeAndReset = (thenClearWo: boolean) => {
    clearRest();
    setSheet(null);
    onClose();
    if (thenClearWo) {
      setWo(null);
      appState.setActive(null);
    }
  };

  const lastNoteFor = (name: string) => {
    for (let i = appState.history.length - 1; i >= 0; i--) {
      const x = appState.history[i].moves[name];
      if (x && x.note) return { note: x.note, date: appState.history[i].date };
    }
    return null;
  };

  // ---- top bar ----
  const totalReal = wo.moves.filter((m) => !isWarmup(m)).length;
  const label =
    phase === "warmup"
      ? "Warm-up"
      : phase === "movement"
      ? `Move ${moveNo(wo.moves, wo.mi)} of ${totalReal} · Session ${wo.idx + 1} · ${wo.letter}`
      : "";
  const showTopBar = phase === "warmup" || phase === "movement";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => closeAndReset(false)}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
        {showTopBar ? (
          <View style={styles.topBar}>
            <View style={styles.topRow}>
              {wo.mi > 0 ? (
                <TouchableOpacity activeOpacity={0.7} onPress={() => goMove(wo.mi - 1)} style={styles.backBtn}>
                  <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.backBtn} />
              )}
              <Text style={[styles.label, { color: colors.muted, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                {label}
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => closeAndReset(false)}>
                <Text style={[styles.exitText, { color: colors.ink2, fontFamily: fonts.bodySemiBold }]}>Save & exit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dots}>
              {wo.moves.map((m, i) => {
                const here = i === wo.mi;
                const bg = here ? colors.accent : m.skipped ? colors.muted : moveDone(m) ? colors.good : colors.line;
                return (
                  <TouchableOpacity activeOpacity={0.7} key={i} style={styles.dotWrap} onPress={() => goMove(i)}>
                    <View style={[styles.dot, { backgroundColor: bg, opacity: m.skipped && !here ? 0.45 : 1 }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {(phase === "warmup" || phase === "movement") && (
            <FadeSwitch id={wo.mi}>
              {phase === "warmup" && wo.moves[wo.mi] ? (
                <WarmupView move={wo.moves[wo.mi]} gym={profile.where === "gym"} onDone={onWarmupDone} />
              ) : null}

              {phase === "movement" && move ? (
                <MovementView
                  move={move}
                  moveIndex={wo.mi}
                  allMoves={wo.moves}
                  units={profile.units}
                  rest={restState}
                  lastNote={lastNoteFor(move.n)}
                  onChangeSetValue={onChangeSetValue}
                  onStepSet={onStepSet}
                  onToggleSet={onToggleSet}
                  onSetFeel={onSetFeel}
                  onNext={advance}
                  onSkipRest={() => {
                    if (!restState || restState.hold <= 0) clearRest();
                  }}
                  onOpenInfo={onOpenInfo}
                  onOpenSwap={onOpenSwap}
                  onOpenHurt={onOpenHurt}
                  onOpenNote={onOpenNote}
                  onOpenFindWeight={onOpenFindWeight}
                  onOpenShortOnTime={onOpenShortOnTime}
                  onUnskip={onUnskip}
                  dropSet={!!wo.dropSet}
                />
              ) : null}
            </FadeSwitch>
          )}

          {phase === "celebrate" && wo.fc ? (
            <CelebrateView
              fc={wo.fc}
              nMoves={totalReal}
              minutes={wo.fc ? logMinutes(wo) : 0}
              moved={movedToday(wo.moves.filter((m) => !isWarmup(m)))}
              ups={wo.moves.filter((m) => m.type === "weight" && !m.skipped && historyWentUp(m, wo, appState.history)).length}
              unit={unitFor(profile.units)}
              blockDone={appState.session >= BLOCK_SESSIONS}
              onSeeResults={() => updateWo({ ...wo, celebrated: true })}
              onShare={() => shareCaption(wo.fc!.caption)}
              onDone={() => closeAndReset(true)}
            />
          ) : null}

          {phase === "finish" && wo.fc
            ? (() => {
                const real = wo.moves.filter((m) => !isWarmup(m));
                const entry = appState.history.find((h) => h.block === wo.block && h.idx === wo.idx);
                if (!entry) return null;
                const firstSame = appState.history.find((h) => h.block === wo.block && h.letter === wo.letter);
                const isFirst = !!firstSame && firstSame.idx === wo.idx;
                const blockDone = appState.session >= BLOCK_SESSIONS;
                const coachLines = coachRead(wo, real, isFirst, appState.history, profile);
                const np = nextPreview(appState.block, appState.session, profile);
                return (
                  <FinishView
                    wo={wo}
                    real={real}
                    fc={wo.fc}
                    history={appState.history}
                    profile={profile}
                    entry={entry}
                    isFirst={isFirst}
                    coachLines={coachLines}
                    nextTitle={blockDone ? "Block done" : np.title}
                    nextMoves={np.moves}
                    blockDone={blockDone}
                    onSaveEntry={(patch) => appState.updateHistoryEntry(wo.block, wo.idx, patch)}
                    onDone={() => {
                      if (blockDone) appState.advanceBlock();
                      closeAndReset(true);
                    }}
                  />
                );
              })()
            : null}
        </ScrollView>
        </KeyboardAvoidingView>

        <Sheet visible={!!sheet} onClose={() => setSheet(null)}>
          <WorkoutSheetRouter
            sheet={sheet}
            move={move}
            profile={profile}
            onSwap={onSwap}
            onSkipHurt={onSkipHurt}
            onSaveNote={onSaveNote}
            onFindWeightSave={onFindWeightSave}
            onShortOnTime={onShortOnTimeConfirm}
            onClose={() => setSheet(null)}
          />
        </Sheet>
      </SafeAreaView>
    </Modal>
  );
}

function logMinutes(wo: ActiveWorkout): number {
  const ms = (wo.activeMs || 0) + (wo.segStart ? Date.now() - wo.segStart : 0);
  return Math.max(1, Math.round(ms / 60000));
}
function historyWentUp(m: ActiveMove, wo: ActiveWorkout, history: HistoryEntry[]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.block === wo.block && h.idx === wo.idx) continue;
    const hm = h.moves[m.n];
    if (hm && hm.w) return !!(m.w && Number(m.w) > Number(hm.w));
  }
  return false;
}
function shareCaption(caption: string) {
  Share.share({ message: caption }).catch(() => {});
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, textAlign: "center", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  exitText: { fontSize: 12 },
  dots: { flexDirection: "row", gap: 5, marginTop: 10 },
  dotWrap: { flex: 1, height: 20, alignItems: "center", justifyContent: "center" },
  dot: { width: "100%", height: 4, borderRadius: 2 },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
});
