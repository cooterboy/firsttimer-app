import React, { useState } from "react";
import { Keyboard, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "../../lib/haptics";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, spacing } from "../../lib/theme";
import { ActiveMove, Profile, SheetState } from "../../lib/types";
import { MUSCLES, MovementVariant, unit } from "../../lib/gymProgram";
import { MOVE_TAGS, WeightHint, startHint } from "../../lib/sessionEngine";

function SheetTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>{children}</Text>
  );
}
function SheetBody({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: colors.ink2 }]}>{children}</Text>;
}
function Opt({
  title,
  small,
  accent,
  onPress,
}: {
  title: string;
  small?: string;
  accent?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.7}
      style={[
        styles.opt,
        { borderColor: accent ? colors.accent : colors.line, backgroundColor: accent ? colors.accent : colors.raised },
      ]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
    >
      <Text style={[styles.optTitle, { color: accent ? colors.accentInk : colors.ink, fontFamily: fonts.bodySemiBold }]}>
        {title}
      </Text>
      {small ? (
        <Text style={[styles.optSmall, { color: accent ? colors.accentInk : colors.muted }]}>{small}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ---- Machine taken / Too hard ----
export function SwapSheetContent({
  move,
  kind,
  onSwap,
  onClose,
}: {
  move: ActiveMove;
  kind: "sub" | "easier";
  onSwap: (alt: MovementVariant, label: string) => void;
  onClose: () => void;
}) {
  const alt = kind === "sub" ? move.orig.sub : move.orig.easier;
  if (!alt) {
    return (
      <View>
        <SheetTitle>No swap needed</SheetTitle>
        <SheetBody>
          {kind === "sub"
            ? "This one doesn't need a machine. Find a bit of floor and go."
            : "Do fewer reps, or fewer sets. That still counts."}
        </SheetBody>
        <Opt title="Got it" onPress={onClose} />
      </View>
    );
  }
  return (
    <View>
      <SheetTitle>{kind === "sub" ? "Machine taken" : "Too hard today"}</SheetTitle>
      <SheetBody>
        {kind === "sub"
          ? "Same muscles, different equipment. Your weight from this movement won't carry over, and that's fine."
          : "Swap to an easier version. It counts the same."}
      </SheetBody>
      <Opt
        title={`Swap to ${alt.n}`}
        small={alt.cue}
        onPress={() => onSwap(alt, kind === "sub" ? "Swapped: machine was taken" : "Swapped: easier version")}
      />
      <Opt title={kind === "sub" ? "Wait for it" : "Try one more set first"} onPress={onClose} />
    </View>
  );
}

// ---- This hurts ----
export function HurtSheetContent({
  move,
  onSwap,
  onSkip,
  onClose,
}: {
  move: ActiveMove;
  onSwap: (alt: MovementVariant, label: string) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const alt = move.orig.easier;
  return (
    <View>
      <SheetTitle>Stop this one.</SheetTitle>
      <SheetBody>
        Sharp, in a joint, or only on one side means it isn't soreness. Skip it today. If it's still there next
        session, message your trainer before doing it again.
      </SheetBody>
      {alt ? <Opt title={`Swap to ${alt.n}`} small={alt.cue} onPress={() => onSwap(alt, "Swapped: something hurt")} /> : null}
      <Opt title="Skip it today" small="Move on. Nothing lost." onPress={onSkip} />
      <Opt title="It's just soreness, keep going" onPress={onClose} />
    </View>
  );
}

// ---- Note ----
export function NoteSheetContent({
  move,
  onSave,
  onClose,
}: {
  move: ActiveMove;
  onSave: (note: string, tags: string[]) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [tags, setTags] = useState<string[]>(move.mtags || []);
  const [note, setNote] = useState(move.note || "");
  return (
    <View>
      <SheetTitle>Note on {move.n}</SheetTitle>
      <SheetBody>Shows up next time this movement comes around. Tags help the app spot patterns.</SheetBody>
      <View style={styles.pillWrap}>
        {MOVE_TAGS.map((t) => {
          const on = tags.includes(t);
          return (
            <TouchableOpacity activeOpacity={0.7}
              key={t}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
              }}
              style={[
                styles.pill,
                { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised },
              ]}
            >
              <Text style={{ color: on ? colors.paper : colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
                {t}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>NOTE</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Seat on 4. Elbow pinched on the last rep."
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
      />
      <Opt
        title="Save"
        accent
        onPress={() => {
          onSave(note.trim(), tags);
          onClose();
        }}
      />
    </View>
  );
}

// ---- Movement info ----
export function InfoSheetContent({ move, onClose }: { move: ActiveMove; onClose: () => void }) {
  const why = MUSCLES[move.n] || MUSCLES[move.orig.n] || "Same muscles as the gym version of this movement.";
  return (
    <View>
      <SheetTitle>{move.n}</SheetTitle>
      <SheetBody>{why}</SheetBody>
      <SheetBody>Cue: {move.cue}</SheetBody>
      <SheetBody>This session: {move.spec}</SheetBody>
      {move.orig.sub ? <SheetBody>If the machine's taken: {move.orig.sub.n}.</SheetBody> : null}
      {move.orig.easier ? <SheetBody>Easier version: {move.orig.easier.n}.</SheetBody> : null}
      <Opt title="Got it" onPress={onClose} />
    </View>
  );
}

// ---- Short on time ----
export function ShortOnTimeSheetContent({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <View>
      <SheetTitle>Short on time?</SheetTitle>
      <SheetBody>
        Drop one set from every movement left in this session. Same movements, same weights, home sooner. It counts
        exactly the same.
      </SheetBody>
      <Opt title="Drop a set this session" accent onPress={onConfirm} />
      <Opt title="Keep going as planned" onPress={onClose} />
    </View>
  );
}

// ---- Find your weight (multi-step) ----
export function FindWeightSheetContent({
  move,
  profile,
  onSave,
  onClose,
}: {
  move: ActiveMove;
  profile: Profile;
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const hint = startHint(move, profile);
  const [step, setStep] = useState<"start" | "feel" | "adjustUp" | "adjustDown" | "confirm">("start");
  const [val, setVal] = useState(hint?.v ? String(hint.v) : "");
  const u = unit(profile.units);
  if (!hint) return null;

  if (step === "start") {
    return (
      <View>
        <SheetTitle>Find your weight</SheetTitle>
        <SheetBody>One minute, and it doesn't count as a set. Nobody is watching and everybody does this.</SheetBody>
        <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
          <BannerText hint={hint} />
        </View>
        <SheetBody>Do 5 slow reps. Stop there even if it's easy.</SheetBody>
        <Opt title="Done — how did that feel?" accent onPress={() => setStep("feel")} />
        <Opt title="I'll just type a number" onPress={() => setStep("confirm")} />
      </View>
    );
  }
  if (step === "feel") {
    return (
      <View>
        <SheetTitle>How did 5 reps feel?</SheetTitle>
        <SheetBody>Be honest. Too light for one set costs you nothing; too heavy costs you the session.</SheetBody>
        <Opt title="I could have done twenty" small="Nowhere near it yet." onPress={() => setStep("adjustUp")} />
        <Opt title="A bit easy" small="Could have done a few more than five." onPress={() => setStep("adjustUp")} />
        <Opt title="About right" small="Five was fine. Ten would be work." accent onPress={() => setStep("confirm")} />
        <Opt title="Too heavy" small="Form went, or five was a fight." onPress={() => setStep("adjustDown")} />
      </View>
    );
  }
  if (step === "adjustUp" || step === "adjustDown") {
    const up = step === "adjustUp";
    return (
      <View>
        <SheetTitle>{up ? "Go up properly." : "Come back down."}</SheetTitle>
        <SheetBody>
          {up
            ? hint.kind === "db"
              ? `Put that down and take ${hint.single ? "one" : "a pair"} about twice as heavy. Do 5 more.`
              : "Up four or five plates. Do 5 more."
            : hint.kind === "db"
            ? `Down ${hint.single ? "one" : "a pair"}. There is no prize for the heavy one today.`
            : "Two plates down. There is no prize for the heavy one today."}
        </SheetBody>
        <Opt title="Done — how did that feel?" accent onPress={() => setStep("feel")} />
        <Opt title="That's close enough" onPress={() => setStep("confirm")} />
      </View>
    );
  }
  return (
    <FindWeightConfirm hint={hint} u={u} val={val} setVal={setVal} onSave={onSave} onClose={onClose} />
  );
}

function FindWeightConfirm({
  hint,
  u,
  val,
  setVal,
  onSave,
  onClose,
}: {
  hint: WeightHint;
  u: string;
  val: string;
  setVal: (v: string) => void;
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <SheetTitle>That's your weight.</SheetTitle>
      <SheetBody>Put the number in and it fills every set. Next time the app remembers it and suggests going up.</SheetBody>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>WHAT ARE YOU ON? ({u})</Text>
      <TextInput
        value={val}
        onChangeText={setVal}
        keyboardType="decimal-pad"
        placeholder={u}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
        autoFocus
      />
      <Opt
        title="Use this for all sets"
        accent
        onPress={() => {
          const n = Number(val);
          if (n > 0) {
            Keyboard.dismiss();
            onSave(n);
            onClose();
          }
        }}
      />
    </View>
  );
}

function BannerText({ hint }: { hint: WeightHint }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>{hint.text}</Text>;
}

export default function WorkoutSheetRouter(props: {
  sheet: SheetState;
  move: ActiveMove | null;
  profile: Profile;
  onSwap: (alt: MovementVariant, label: string) => void;
  onSkipHurt: () => void;
  onSaveNote: (note: string, tags: string[]) => void;
  onFindWeightSave: (value: number) => void;
  onShortOnTime: () => void;
  onClose: () => void;
}) {
  const { sheet, move, profile, onSwap, onSkipHurt, onSaveNote, onFindWeightSave, onShortOnTime, onClose } = props;
  if (!sheet || !move) return null;
  switch (sheet.kind) {
    case "swap":
      return <SwapSheetContent move={move} kind={sheet.swapKind} onSwap={onSwap} onClose={onClose} />;
    case "hurt":
      return <HurtSheetContent move={move} onSwap={onSwap} onSkip={onSkipHurt} onClose={onClose} />;
    case "note":
      return <NoteSheetContent move={move} onSave={onSaveNote} onClose={onClose} />;
    case "info":
      return <InfoSheetContent move={move} onClose={onClose} />;
    case "shortOnTime":
      return <ShortOnTimeSheetContent onConfirm={onShortOnTime} onClose={onClose} />;
    case "findWeight":
      return <FindWeightSheetContent move={move} profile={profile} onSave={onFindWeightSave} onClose={onClose} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 24, letterSpacing: 0.5, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  opt: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    marginBottom: 10,
  },
  optTitle: { fontSize: 14 },
  optSmall: { fontSize: 12, marginTop: 3, opacity: 0.8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  pill: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 7 },
  input: {
    width: "100%",
    padding: 13,
    fontSize: 16,
    borderRadius: 11,
    marginBottom: 14,
  },
  banner: {
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
  },
});
