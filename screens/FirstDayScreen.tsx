import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { FIRST_DAY } from "../lib/gymProgram";
import { WHERE_LABEL } from "../lib/types";
import Card from "../components/Card";

// Ports the prototype's SUB.firstday (spec/prototype.html:3564-3573).
export default function FirstDayScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { profile } = useAppState();
  const [open, setOpen] = useState<number | null>(null);
  const guide = FIRST_DAY[profile.where] || FIRST_DAY.gym;

  const rows = [
    { title: "About 35 minutes", body: "Five minutes warming up, then five movements with a rest between each set." },
    { title: "One movement at a time", body: "The app shows one screen per movement. You never have to remember what's next." },
    { title: "Nothing is mandatory", body: "Too hard, machine taken, or it hurts — every movement has a one-tap way out. Finishing beats doing it perfectly." },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Your first day</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lede, { color: colors.ink2 }]}>
          The things nobody tells a beginner, for {WHERE_LABEL[profile.where].toLowerCase()}. Change where you train
          under Training preferences and this changes with it.
        </Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {guide.map((g, i) => {
            const isOpen = open === i;
            return (
              <TouchableOpacity
                key={g.title}
                activeOpacity={0.7}
                onPress={() => setOpen(isOpen ? null : i)}
                style={[styles.accordionRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <View style={styles.accordionHead}>
                  <Text style={[styles.accordionTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{g.title}</Text>
                  <Text style={{ color: colors.muted }}>{isOpen ? "–" : "+"}</Text>
                </View>
                {isOpen ? <Text style={[styles.accordionBody, { color: colors.ink2 }]}>{g.body}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </Card>

        <Card style={{ marginTop: spacing.lg, padding: 0, overflow: "hidden" }}>
          {rows.map((r, i) => (
            <View key={r.title} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={styles.moveText}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{r.title}</Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>{r.body}</Text>
              </View>
            </View>
          ))}
        </Card>
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
  accordionRow: { padding: 14 },
  accordionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accordionTitle: { fontSize: 14 },
  accordionBody: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  moveText: { flex: 1 },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
