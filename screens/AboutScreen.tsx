import React from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";

// Ports the prototype's SUB.about (spec/prototype.html:3609-3612). Version
// and trainer-signoff status are real product facts, not prototype flavor —
// kept honest rather than copied verbatim: real app.json version instead of
// the prototype's own "0.4 · prototype", and "Pending" left as-is since
// there's no evidence the trainer signoff has actually happened yet.
export default function AboutScreen() {
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
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>About</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mark}>
          <Text style={[styles.markText, { color: colors.ink, fontFamily: fonts.display }]}>
            FIRST{"\n"}
            <Text style={{ color: colors.accent }}>TIMER</Text>
          </Text>
          <View style={styles.markBar}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={[styles.markSeg, { backgroundColor: i < 2 ? colors.accent : colors.line }]} />
            ))}
          </View>
        </View>

        <View style={[styles.group, { borderColor: colors.line }]}>
          <View style={[styles.item, { borderBottomColor: colors.line }]}>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Version</Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 13 }}>1.0.0</Text>
          </View>
          <View style={[styles.item, { borderBottomColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Gym program</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Written and signed off by a certified trainer.</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Pending</Text>
          </View>
          <View style={[styles.item, { borderBottomColor: colors.line, borderBottomWidth: 0 }]}>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Made in</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Salt Lake City</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL("https://firsttimer.co")}
          style={[styles.linkRow, { borderColor: colors.line, backgroundColor: colors.raised }]}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium, fontSize: 14 }}>firsttimer.co</Text>
          <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.muted }]}>Everyone starts here.</Text>
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
  mark: { alignItems: "center", paddingVertical: spacing.lg },
  markText: { fontSize: 40, textAlign: "center", lineHeight: 42 },
  markBar: { flexDirection: "row", gap: 3, marginTop: 10 },
  markSeg: { width: 9, height: 4, borderRadius: 2 },
  group: { borderWidth: 1, borderRadius: 14, marginTop: spacing.md, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, gap: 10 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1, marginTop: spacing.md },
  footer: { fontSize: 13, textAlign: "center", marginTop: spacing.xl },
});
