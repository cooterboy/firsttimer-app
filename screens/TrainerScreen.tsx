import React from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { TRAINER } from "../lib/trainerContent";
import Card from "../components/Card";

// The certified trainer behind the program (lib/trainerContent.ts). Not in the
// prototype — added so the "written and signed off by a certified trainer" line
// the app repeats (About, FAQ, the nutrition card) has a person behind it.
// Reached from the Programs tab, next to "Your first day".
export default function TrainerScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const t = TRAINER;
  const initials = t.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Only ever opens a real https profile link.
  const socialUrl = t.social?.url && /^https:\/\//.test(t.social.url) ? t.social.url : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Your trainer</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {t.placeholder ? (
          <View style={[styles.banner, { backgroundColor: colors.warnSoft }]}>
            <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Placeholder. </Text>
              The real trainer's name, credentials and bio go here before launch.
            </Text>
          </View>
        ) : null}

        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accentDeep, fontFamily: fonts.display, fontSize: 24 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.display }]}>{t.name}</Text>
            <Text style={[styles.role, { color: colors.muted }]}>Wrote and signs off on the gym program.</Text>
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>CREDENTIALS</Text>
        <Card>
          {t.credentials.map((c) => (
            <View key={c} style={styles.checkRow}>
              <Text style={{ color: colors.good, marginRight: 8 }}>✓</Text>
              <Text style={{ color: colors.ink2, fontSize: 14, flex: 1, lineHeight: 20 }}>{c}</Text>
            </View>
          ))}
        </Card>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>ABOUT</Text>
        <Card>
          <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 21 }}>{t.bio}</Text>
        </Card>

        {t.social ? (
          <TouchableOpacity
            activeOpacity={socialUrl ? 0.7 : 1}
            disabled={!socialUrl}
            onPress={() => socialUrl && Linking.openURL(socialUrl)}
            accessibilityRole={socialUrl ? "link" : undefined}
            style={[styles.navCard, { backgroundColor: colors.raised }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowK, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{t.social.label}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                {t.social.handle}
                {socialUrl ? "" : " · not connected yet"}
              </Text>
            </View>
            {socialUrl ? <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text> : null}
          </TouchableOpacity>
        ) : null}
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
  banner: { borderRadius: 12, padding: 12, marginBottom: spacing.lg },
  head: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 26, letterSpacing: 0.5 },
  role: { fontSize: 13, marginTop: 2 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 5 },
  navCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 16, marginTop: spacing.lg },
  rowK: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 2 },
});
