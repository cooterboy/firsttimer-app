import React, { useState } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import {
  ACTIVITY_LABEL,
  Activity,
  Goal,
  GOAL_LABEL,
  PAIN_AREAS,
  PainArea,
  TrainingDays,
  Where,
  WHERE_LABEL,
  Why,
  WHY_LABEL,
  painAreaLabel,
} from "../lib/types";

// Ports the prototype's 4-step onboarding wizard (spec/prototype.html:658-765) —
// minus step 1 (name/email/password/age/units), which AuthScreen's sign-up form
// already collects. This screen is steps 2-4: "Your first time" (where, days),
// "Where you're at" (activity, goal, why), "So we can adjust" (pain, weight,
// height, medical disclaimer). Shown once, gated in App.tsx on
// !profile.medicalDisclaimerAccepted — see that file for why that one field
// doubles as the "has this account finished onboarding" flag.
const STEPS = ["Your first time.", "Where you're at.", "So we can adjust."];

function Pill({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[
        styles.pill,
        { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.fieldLabel, { color: colors.muted }]}>{children}</Text>;
}

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const appState = useAppState();
  const p = appState.profile;
  const [step, setStep] = useState(0);

  // Local staging so nothing writes to appState until "Next"/"Start session 1" —
  // matches the prototype's `ob` scratch object, applied to `state.profile` only
  // once the whole wizard completes.
  const [where, setWhere] = useState<Where>(p.where);
  const [days, setDays] = useState<TrainingDays>(p.days);
  const [activity, setActivity] = useState<Activity | null>(p.activity);
  const [goal, setGoal] = useState<Goal | null>(p.goal);
  const [why, setWhy] = useState<Why | null>(p.why);
  const [pain, setPain] = useState<PainArea[]>(p.pain);
  const [weight, setWeight] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [disclaimer, setDisclaimer] = useState(false);

  const canNext = step === 0 ? !!(where && days) : step === 1 ? !!(activity && goal) : disclaimer;

  const finish = () => {
    const nextHeightCm = p.units === "metric" ? Number(heightCm) || null : (Number(heightFt) || 0) * 30.48 + (Number(heightIn) || 0) * 2.54 || null;
    appState.updateProfile({
      where,
      days,
      activity,
      goal,
      why,
      pain: pain.length ? pain : [],
      weight: Number(weight) || p.weight,
      heightCm: nextHeightCm || p.heightCm,
      medicalDisclaimerAccepted: true,
    });
    onDone();
  };

  const next = () => {
    if (!canNext) return;
    Keyboard.dismiss();
    Haptics.selectionAsync().catch(() => {});
    if (step < 2) setStep(step + 1);
    else finish();
  };

  const back = () => {
    Haptics.selectionAsync().catch(() => {});
    if (step > 0) setStep(step - 1);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.line }]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>{STEPS[step]}</Text>

        {step === 0 ? (
          <>
            <Text style={[styles.lede, { color: colors.ink2 }]}>Pick what you're starting. The first block is always free.</Text>
            <FieldLabel>WHERE YOU'LL TRAIN</FieldLabel>
            <View style={styles.pillWrap}>
              {(Object.keys(WHERE_LABEL) as Where[]).map((k) => (
                <Pill key={k} label={WHERE_LABEL[k]} on={where === k} onPress={() => setWhere(k)} />
              ))}
            </View>
            <FieldLabel>DAYS A WEEK</FieldLabel>
            <View style={styles.pillWrap}>
              <Pill label="2 days" on={days === 2} onPress={() => setDays(2)} />
              <Pill label="3 days" on={days === 3} onPress={() => setDays(3)} />
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Text style={[styles.lede, { color: colors.ink2 }]}>No wrong answers. This sets the starting point.</Text>
            <FieldLabel>ACTIVITY LEVEL RIGHT NOW</FieldLabel>
            <View style={styles.pillWrap}>
              {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((k) => (
                <Pill key={k} label={ACTIVITY_LABEL[k]} on={activity === k} onPress={() => setActivity(k)} />
              ))}
            </View>
            <FieldLabel>MAIN GOAL</FieldLabel>
            <View style={styles.pillWrap}>
              {(Object.keys(GOAL_LABEL) as Goal[]).map((k) => (
                <Pill key={k} label={GOAL_LABEL[k]} on={goal === k} onPress={() => setGoal(k)} />
              ))}
            </View>
            <FieldLabel>WHY NOW</FieldLabel>
            <View style={styles.pillWrap}>
              {(Object.keys(WHY_LABEL) as Why[]).map((k) => (
                <Pill key={k} label={WHY_LABEL[k]} on={why === k} onPress={() => setWhy(k)} />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.lede, { color: colors.ink2 }]}>The program swaps movements around anything that hurts.</Text>
            <FieldLabel>ANYTHING THAT HURTS</FieldLabel>
            <View style={styles.pillWrap}>
              {PAIN_AREAS.map((k) => {
                const on = pain.includes(k);
                return (
                  <Pill
                    key={k}
                    label={painAreaLabel(k)}
                    on={on}
                    onPress={() => setPain(on ? pain.filter((x) => x !== k) : [...pain, k])}
                  />
                );
              })}
            </View>

            <FieldLabel>{p.units === "metric" ? "WEIGHT (KG)" : "WEIGHT (LB)"}</FieldLabel>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="optional"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
            />
            {p.units === "metric" ? (
              <>
                <FieldLabel>HEIGHT (CM)</FieldLabel>
                <TextInput
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="optional"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                />
              </>
            ) : (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>HEIGHT (FT)</FieldLabel>
                  <TextInput
                    value={heightFt}
                    onChangeText={setHeightFt}
                    placeholder="5"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>(IN)</FieldLabel>
                  <TextInput
                    value={heightIn}
                    onChangeText={setHeightIn}
                    placeholder="9"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                  />
                </View>
              </View>
            )}
            <Text style={[styles.note, { color: colors.muted }]}>Private. Only you see these, and they're optional.</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.checkRow}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setDisclaimer((d) => !d);
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.line },
                  disclaimer && { backgroundColor: colors.ink, borderColor: colors.ink },
                ]}
              >
                {disclaimer ? <Text style={{ color: colors.paper, fontSize: 12 }}>✓</Text> : null}
              </View>
              <Text style={[styles.checkText, { color: colors.muted }]}>
                This isn't medical advice. I'll check with a doctor if I'm unsure, and stop if something hurts.
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!canNext}
          onPress={next}
          style={[styles.primary, { backgroundColor: colors.accent, opacity: canNext ? 1 : 0.4 }]}
        >
          <Text style={{ color: colors.accentInk, fontFamily: fonts.display, fontSize: 18 }}>
            {step === 2 ? "Start session 1" : "Next"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.backBtn} onPress={back} disabled={step === 0}>
          <Text style={{ color: step === 0 ? "transparent" : colors.ink2, fontSize: 14 }}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  big: { fontSize: 32, letterSpacing: 0.5, marginBottom: 4 },
  lede: { fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: spacing.md, marginBottom: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  input: { borderRadius: 10, padding: 12, fontSize: 14 },
  row2: { flexDirection: "row", gap: 10 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: spacing.lg },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { flex: 1, fontSize: 12, lineHeight: 17 },
  footer: { padding: spacing.lg, paddingTop: 0 },
  primary: { borderRadius: 13, paddingVertical: 16, alignItems: "center" },
  backBtn: { alignItems: "center", paddingVertical: 12 },
});
