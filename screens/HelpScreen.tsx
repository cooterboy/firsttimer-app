import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { FAQ } from "../lib/faqContent";
import Sheet from "../components/workout/Sheet";

const SUPPORT_EMAIL = "support@firsttimer.co";

// Ports the prototype's SUB.help (spec/prototype.html:3589-3595) — an FAQ
// accordion plus a "talk to a person" card with copy-address and
// report-a-problem actions.
export default function HelpScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [bugText, setBugText] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy address");

  const copyEmail = async () => {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    Haptics.selectionAsync().catch(() => {});
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy address"), 1800);
  };

  const sendBugReport = () => {
    setReportOpen(false);
    setBugText("");
    Alert.alert("Thanks.", "We'll read it.");
  };

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
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Help & support</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }]}>
          {FAQ.map((f, i) => {
            const open = openIdx === i;
            return (
              <TouchableOpacity
                key={f.q}
                activeOpacity={0.7}
                onPress={() => setOpenIdx(open ? null : i)}
                style={[styles.faqRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[styles.faqQ, { color: colors.ink, fontFamily: fonts.bodySemiBold, flex: 1 }]}>{f.q}</Text>
                  <Text style={{ color: colors.muted, fontSize: 18, marginLeft: 8 }}>{open ? "–" : "+"}</Text>
                </View>
                {open ? <Text style={[styles.faqA, { color: colors.ink2 }]}>{f.a}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>TALK TO A PERSON</Text>
        <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }]}>
          <View style={styles.emailRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium }}>Email</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>We answer within a day, usually faster.</Text>
            </View>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>{SUPPORT_EMAIL}</Text>
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity activeOpacity={0.7} onPress={copyEmail} style={[styles.copyBtn, { borderColor: colors.line }]}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{copyLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setReportOpen(true)}
              style={[styles.copyBtn, { borderColor: colors.line }]}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Report a problem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Sheet visible={reportOpen} onClose={() => setReportOpen(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink, fontFamily: fonts.display }]}>Report a problem</Text>
        <Text style={[styles.sheetNote, { color: colors.ink2 }]}>
          Tell us what happened. Your session number and device come along automatically.
        </Text>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>What went wrong</Text>
        <TextInput
          value={bugText}
          onChangeText={setBugText}
          placeholder="The rest timer didn't start on…"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
        />
        <TouchableOpacity activeOpacity={0.8} onPress={sendBugReport} style={[styles.sendBtn, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Send</Text>
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: spacing.lg, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  faqRow: { padding: 14 },
  faqQ: { fontSize: 14 },
  faqA: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  emailRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, gap: 10 },
  btnRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  copyBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  sheetTitle: { fontSize: 22, letterSpacing: 0.5, marginBottom: 8 },
  sheetNote: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 6 },
  input: { borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16 },
  sendBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
});
