import React from "react";
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, radius, spacing, type } from "../../lib/theme";
import { ActiveMove } from "../../lib/types";
import { unit } from "../../lib/gymProgram";
import { fmtDate, moveNo, nextLabel } from "../../lib/sessionEngine";
import SetRow from "./SetRow";

type RestState = { total: number; left: number; hold: number } | null;

export default function MovementView({
  move,
  moveIndex,
  allMoves,
  units,
  rest,
  lastNote,
  onChangeSetValue,
  onStepSet,
  onToggleSet,
  onSetFeel,
  onNext,
  onSkipRest,
  onOpenInfo,
  onOpenSwap,
  onOpenHurt,
  onOpenNote,
  onOpenFindWeight,
  onOpenShortOnTime,
  onUnskip,
  dropSet,
}: {
  move: ActiveMove;
  moveIndex: number;
  allMoves: ActiveMove[];
  units: "imperial" | "metric";
  rest: RestState;
  lastNote: { note: string; date: string } | null;
  onChangeSetValue: (i: number, v: string) => void;
  onStepSet: (i: number, dir: 1 | -1) => void;
  onToggleSet: (i: number) => void;
  onSetFeel: (feel: "easy" | "right" | "hard") => void;
  onNext: () => void;
  onSkipRest: () => void;
  onOpenInfo: () => void;
  onOpenSwap: (kind: "sub" | "easier") => void;
  onOpenHurt: () => void;
  onOpenNote: () => void;
  onOpenFindWeight: () => void;
  onOpenShortOnTime: () => void;
  onUnskip: () => void;
  dropSet: boolean;
}) {
  const { colors } = useTheme();
  const u = unit(units);
  const allDone = move.done.length >= move.sets;
  const firstTime = move.type === "weight" && !move.hadLast && !move.setW.some((v) => v);

  const hintLine =
    move.type === "weight"
      ? move.hold
        ? `${move.hold}${move.hadLast ? " Change any set." : ""}`
        : move.suggested
        ? `Last time ${move.suggested} ${u} felt easy. Try ${move.setW[0]}.`
        : move.hadLast
        ? "Prefilled from last time. Change any set."
        : "First time on this one. Nobody knows their number on day one — the app will work it out with you."
      : move.type === "time"
      ? "Hold for the time, rest, repeat."
      : "Count reps out loud. Slow beats fast.";

  return (
    <View>
      {move.skipped ? (
        <View style={[styles.banner, { backgroundColor: colors.warnSoft }]}>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>You skipped this one.</Text> It's still here if you want it.
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={onUnskip} style={styles.inlineBtnWrap}>
            <Text style={[styles.inlineBtn, { color: colors.ink, borderColor: colors.line }]}>Actually, I'll do it</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.video, { backgroundColor: colors.ink }]}>
        <View style={[styles.ring, { borderColor: colors.paper }]} />
        <Text style={[styles.videoTitle, { color: colors.paper, fontFamily: fonts.display }]}>{move.n}</Text>
        <Text style={[styles.videoSub, { color: colors.paper }]}>20-second clip · coming soon</Text>
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={onOpenInfo} style={styles.nameRow}>
        <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.display }]}>{move.n}</Text>
        <View style={[styles.infoI, { borderColor: colors.muted }]}>
          <Text style={{ color: colors.muted, fontSize: 11, fontFamily: fonts.bodyBold }}>i</Text>
        </View>
      </TouchableOpacity>
      <Text style={[styles.spec, { color: colors.muted, fontFamily: fonts.mono }]}>{move.spec}</Text>
      {move.swapped ? <Text style={[styles.swapped, { color: colors.warn }]}>{move.swapped}</Text> : null}
      <Text style={[styles.cue, { color: colors.ink2 }]}>{move.cue}</Text>

      <Text style={[styles.hint, { color: colors.muted }]}>{hintLine}</Text>
      {firstTime ? (
        <TouchableOpacity activeOpacity={0.7}
          onPress={onOpenFindWeight}
          style={[styles.ghost, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accentDeep, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
            Help me pick a weight
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.setrows}>
        {Array.from({ length: move.sets }).map((_, i) => {
          const done = move.done.includes(i);
          const isNext = !done && i === move.done.length;
          return (
            <SetRow
              key={i}
              index={i}
              label={`Set ${i + 1}`}
              isWeight={move.type === "weight"}
              specRight={move.spec.split(" × ")[1] || move.spec}
              value={move.setW[i] || ""}
              unit={u}
              done={done}
              isNext={isNext}
              holdSeconds={isNext ? rest?.hold || 0 : 0}
              onChangeValue={(v) => onChangeSetValue(i, v)}
              onStep={(dir) => onStepSet(i, dir)}
              onToggleDone={() => onToggleSet(i)}
            />
          );
        })}
      </View>

      {move.fb ? (
        <View
          style={[
            styles.fbBanner,
            {
              backgroundColor: move.fb.kind === "up" ? colors.goodSoft : move.fb.kind === "down" ? colors.warnSoft : colors.sunken,
            },
          ]}
        >
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>{move.fb.text}</Text>
        </View>
      ) : null}

      {rest ? (
        <View style={[styles.rest, { backgroundColor: colors.ink }]}>
          <View>
            <Text style={[styles.restTime, { color: colors.paper, fontFamily: fonts.display }]}>{rest.left}s</Text>
            <Text style={[styles.restLabel, { color: colors.paper }]}>Rest</Text>
          </View>
          <View style={[styles.restBar, { backgroundColor: "rgba(140,140,140,.35)" }]}>
            <View
              style={[
                styles.restBarFill,
                { backgroundColor: colors.accent, width: `${Math.round((1 - rest.left / rest.total) * 100)}%` },
              ]}
            />
          </View>
          <TouchableOpacity activeOpacity={0.7} disabled={rest.hold > 0} onPress={onSkipRest}>
            <Text style={{ color: colors.paper, opacity: rest.hold > 0 ? 0.45 : 1, fontFamily: fonts.bodyBold, fontSize: 13 }}>
              {rest.hold > 0 ? `Skip in ${rest.hold}` : "Skip"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {rest && rest.hold > 0 ? (
        <Text style={[styles.restWhy, { color: colors.muted }]}>
          Breathe. The next set unlocks in {rest.hold}. It's meant to feel like the last one.
        </Text>
      ) : null}

      {allDone ? (
        <View style={styles.feel}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>HOW DID THAT FEEL?</Text>
          <View style={styles.feelRow}>
            {(["easy", "right", "hard"] as const).map((f) => {
              const on = move.feel === f;
              return (
                <TouchableOpacity activeOpacity={0.7}
                  key={f}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onSetFeel(f);
                  }}
                  style={[
                    styles.feelBtn,
                    { borderColor: colors.line, backgroundColor: on ? colors.ink : colors.raised },
                  ]}
                >
                  <Text style={{ color: on ? colors.paper : colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
                    {{ easy: "Easy", right: "About right", hard: "Hard" }[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity activeOpacity={0.7}
            disabled={!move.feel}
            onPress={onNext}
            style={[styles.primary, { backgroundColor: colors.accent, opacity: move.feel ? 1 : 0.4 }]}
          >
            <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>
              {nextLabel(allMoves, moveIndex)}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {lastNote ? (
        <View style={[styles.banner, { backgroundColor: colors.warnSoft, marginTop: spacing.md }]}>
          <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>Your note from {fmtDate(lastNote.date)}:</Text> {lastNote.note}
          </Text>
        </View>
      ) : null}
      {move.note || (move.mtags && move.mtags.length) ? (
        <View style={[styles.banner, { backgroundColor: colors.sunken, marginTop: spacing.sm }]}>
          <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>Note:</Text>{" "}
            {[(move.mtags || []).join(", "), move.note].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ) : null}

      <View style={styles.helpers}>
        <TouchableOpacity activeOpacity={0.7} style={[styles.helperBtn, { borderColor: colors.line }]} onPress={() => onOpenSwap("sub")}>
          <Text style={[styles.helperText, { color: colors.ink2 }]}>Machine taken</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={[styles.helperBtn, { borderColor: colors.line }]} onPress={() => onOpenSwap("easier")}>
          <Text style={[styles.helperText, { color: colors.ink2 }]}>Too hard</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={[styles.helperBtn, { borderColor: colors.bad }]} onPress={onOpenHurt}>
          <Text style={[styles.helperText, { color: colors.bad }]}>This hurts</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={[styles.helperBtn, { borderColor: colors.line }]} onPress={onOpenNote}>
          <Text style={[styles.helperText, { color: colors.ink2 }]}>Note</Text>
        </TouchableOpacity>
      </View>
      {!dropSet ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onOpenShortOnTime} style={[styles.ghost, { borderColor: colors.line, marginTop: 8 }]}>
          <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Short on time today</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 13, borderRadius: 12, marginBottom: 12 },
  inlineBtnWrap: { marginTop: 8 },
  inlineBtn: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7, alignSelf: "flex-start" },
  video: {
    aspectRatio: 4 / 5,
    maxHeight: 260,
    width: "100%",
    borderRadius: radius,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, opacity: 0.5 },
  videoTitle: { fontSize: 22, letterSpacing: 0.5 },
  videoSub: { fontSize: 12, opacity: 0.6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  name: { fontSize: 32, letterSpacing: 0.5 },
  infoI: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  spec: { fontSize: 14, marginTop: 4 },
  swapped: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  cue: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  ghost: { borderWidth: 1, borderRadius: 13, padding: 13, alignItems: "center", marginTop: 10 },
  setrows: { marginTop: 10, gap: 8 },
  fbBanner: { padding: 13, borderRadius: 12, marginTop: 12 },
  rest: { marginTop: 14, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  restTime: { fontSize: 22, lineHeight: 22 },
  restLabel: { fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 },
  restBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  restBarFill: { height: "100%", borderRadius: 2 },
  restWhy: { fontSize: 12, textAlign: "center", marginTop: 8 },
  feel: { marginTop: 14 },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  feelRow: { flexDirection: "row", gap: 8 },
  feelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primary: { marginTop: 14, borderRadius: 13, padding: 16, alignItems: "center" },
  helpers: { flexDirection: "row", gap: 8, marginTop: 16 },
  helperBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  helperText: { fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center" },
});
