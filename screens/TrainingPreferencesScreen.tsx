import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { PAIN_AREAS, PainArea, Where, WHERE_LABEL, painAreaLabel } from "../lib/types";

const LENGTHS: { v: number; l: string }[] = [
  { v: 30, l: "30" },
  { v: 45, l: "45" },
  { v: 60, l: "60 min" },
];

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[pillStyles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised }]}
    >
      <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{label}</Text>
    </TouchableOpacity>
  );
}
const pillStyles = StyleSheet.create({
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
});

export default function TrainingPreferencesScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const length = appState.profile.length;

  const detail =
    length <= 30 ? "2 sets of everything." : length >= 60 ? "4 sets, 3 in your first week." : "3 sets, 2 in your first week.";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Training preferences</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lede, { color: colors.ink2 }]}>Changes apply from your next session. Your history stays.</Text>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>SCHEDULE</Text>
        <View style={[styles.group, { borderColor: colors.line }]}>
          <View style={styles.item}>
            <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium }}>Training days</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
              Monday, Wednesday, Friday. Changing which days you train is a later build step — for now the plan is
              fixed at 3 a week.
            </Text>
          </View>
          <View style={[styles.item, { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium, marginBottom: 4 }}>
              Session length
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10, lineHeight: 16 }}>{detail} Same movements either way.</Text>
            <View style={[styles.seg, { backgroundColor: colors.sunken }]}>
              {LENGTHS.map((o) => {
                const on = length === o.v;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    key={o.v}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      appState.updateProfile({ length: o.v });
                    }}
                    style={[styles.segBtn, on && { backgroundColor: colors.raised }]}
                  >
                    <Text style={{ color: on ? colors.ink : colors.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>
                      {o.l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>WHERE AND WHAT</Text>
        <View style={[styles.group, { borderColor: colors.line }]}>
          <View style={styles.item}>
            <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium }}>Where you train</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 10, lineHeight: 16 }}>
              Home programs are placeholders until the trainer writes them — picking one won't change your movements
              yet, just what the app calls it.
            </Text>
            <View style={styles.pillWrap}>
              {(Object.keys(WHERE_LABEL) as Where[]).map((k) => (
                <Pill
                  key={k}
                  label={WHERE_LABEL[k]}
                  on={appState.profile.where === k}
                  onPress={() => {
                    appState.updateProfile({ where: k });
                    appState.setActive(null);
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>BODY</Text>
        <View style={[styles.group, { borderColor: colors.line }]}>
          <View style={styles.item}>
            <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium }}>Anything that hurts</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 10, lineHeight: 16 }}>
              Movements swap around it automatically.
            </Text>
            <View style={styles.pillWrap}>
              {PAIN_AREAS.map((k) => {
                const on = appState.profile.pain.includes(k);
                return (
                  <Pill
                    key={k}
                    label={painAreaLabel(k)}
                    on={on}
                    onPress={() => {
                      const next: PainArea[] = on
                        ? appState.profile.pain.filter((x) => x !== k)
                        : [...appState.profile.pain, k];
                      appState.updateProfile({ pain: next });
                      appState.setActive(null);
                    }}
                  />
                );
              })}
            </View>
          </View>
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
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  group: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  item: { padding: 14 },
  seg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2, alignSelf: "flex-start" },
  segBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
