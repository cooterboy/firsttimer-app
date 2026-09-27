import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { LEGAL_LAST_UPDATED, LegalSection } from "../lib/legalContent";

// Shared shell for Privacy and Terms — same structure, different content.
export default function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>{title}</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.draftBadge, { backgroundColor: colors.warnSoft }]}>
          <Text style={{ color: colors.warn, fontSize: 11, fontFamily: fonts.bodyBold, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Draft · attorney review pending
          </Text>
        </View>
        {sections.map((s, i) => (
          <View key={s.h} style={[styles.section, i === 0 && { marginTop: spacing.lg }]}>
            <Text style={[styles.h, { color: colors.ink, fontFamily: fonts.bodyBold }]}>{s.h}</Text>
            <Text style={[styles.body, { color: colors.ink2 }]}>{s.body}</Text>
          </View>
        ))}
        <Text style={[styles.updated, { color: colors.muted }]}>Last updated {LEGAL_LAST_UPDATED}.</Text>
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
  draftBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  section: { marginTop: spacing.lg },
  h: { fontSize: 15, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
  updated: { fontSize: 12, marginTop: spacing.xl, textAlign: "center" },
});
