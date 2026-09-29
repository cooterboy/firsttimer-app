import React, { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { useWorkoutModal } from "../lib/workoutModal";
import { RECOVERY_KINDS, mapSearchUrl } from "../lib/locatorContent";
import { recoveryCooldownActive, recoverySignal } from "../lib/sessionEngine";
import Card from "../components/Card";

// Ports the prototype's SUB.recovery (spec/prototype.html:3269-3294). The soreness
// read at the top is real — it looks at the last 6 real sessions' tags/mtags, same
// as the prototype, via the shared recoverySignal() (also drives Today's mobility-swap
// escalation). The map-search pills are real too (see FindGymScreen).
export default function RecoveryScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const workoutModal = useWorkoutModal();
  const [city, setCity] = useState(appState.profile.city);

  const { hot } = recoverySignal(appState.history);
  const cooldownActive = recoveryCooldownActive(appState.profile.recoveryAdjustedAt);
  const escalated = !!appState.profile.recoveryAdjustedAt && !cooldownActive && hot;

  const helps = [
    { k: "Sleep", s: "Seven hours or more on training nights. It's where the session turns into muscle." },
    { k: "Protein and food", s: "Under-eating reads exactly like overtraining. Check the numbers under Shop." },
    { k: "Walk on off days", s: "Twenty easy minutes moves more blood through a sore joint than sitting still does." },
    { k: "Take the mobility day", s: "It's in the plan for this reason. It's the one people skip." },
    { k: "Drop the weight, keep the session", s: "Too hard on any movement swaps it for an easier version in one tap." },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Recovery</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lede, { color: colors.ink2 }]}>
          {escalated
            ? "This has stuck around through a mobility swap and a few easier days. That's worth a real look — a doctor or your gym's trainer, not another adjustment in here."
            : hot
            ? "You've flagged something sore more than once lately. Start with the free things below; the map is there if it doesn't settle."
            : "For when something isn't settling between sessions."}
        </Text>

        <Card>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>WHAT ACTUALLY HELPS FIRST</Text>
          <Text style={[styles.note, { color: colors.muted, marginBottom: 12 }]}>
            In roughly this order, and all of it free. A cold plunge is not the fix for a knee that's been aching for
            two weeks.
          </Text>
          {helps.map((h) => (
            <View key={h.k} style={styles.helpRow}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{h.k}</Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>{h.s}</Text>
            </View>
          ))}
        </Card>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.ghostBtn, { borderColor: colors.line }]}
          onPress={() => {
            navigation.goBack();
            workoutModal.openMobility();
          }}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Do a mobility day</Text>
        </TouchableOpacity>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>PLACES NEAR YOU</Text>
        <Card>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>WHERE ARE YOU</Text>
          <TextInput
            value={city}
            onChangeText={(v) => {
              setCity(v);
              appState.updateProfile({ city: v });
            }}
            placeholder="South Jordan, UT or 84095"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
          />
          <Text style={[styles.note, { color: colors.muted, marginTop: -4, marginBottom: 12 }]}>
            The App Store version uses your phone's location. Here, type a city or zip.
          </Text>
          <View style={styles.pillWrap}>
            {RECOVERY_KINDS.map((g) => (
              <TouchableOpacity
                key={g.k}
                activeOpacity={0.7}
                style={[styles.pill, { borderColor: colors.line }]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  Linking.openURL(mapSearchUrl(g.q, city));
                }}
              >
                <Text style={{ color: colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{g.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>
            Each opens a map search in a new tab. Nothing about you is sent.
          </Text>
        </Card>

        <View style={[styles.warnBanner, { backgroundColor: colors.warnSoft }]}>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>We can point you at places, not at a diagnosis.</Text> Pain
            that wakes you up, doesn't ease with rest, or has lasted more than two weeks is a doctor's question.
            Nothing in this app is medical advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  lede: { fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 6 },
  note: { fontSize: 12, lineHeight: 17 },
  helpRow: { paddingVertical: 8 },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  ghostBtn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center", marginTop: spacing.md },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 6 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  warnBanner: { borderRadius: 12, padding: 13, marginTop: spacing.lg },
});
