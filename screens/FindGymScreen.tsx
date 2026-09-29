import React, { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { GYM_KINDS, mapSearchUrl } from "../lib/locatorContent";
import Card from "../components/Card";

// Ports the prototype's SUB.findgym (spec/prototype.html:3296-3313). The map-search
// pills are real (they open an actual Google Maps search) — only the "your city"
// field is app-local state, same as the prototype's own state.city.
export default function FindGymScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const [city, setCity] = useState(appState.profile.city);
  const isGym = appState.profile.where === "gym";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Find a gym</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lede, { color: colors.ink2 }]}>
          {isGym
            ? "A second gym for travel, or a studio to try on a rest day."
            : "Ready to try a gym? Find one, walk in, and the program switches to the gym version whenever you want."}
        </Text>

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
            {GYM_KINDS.map((g) => (
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

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>BEFORE YOU WALK IN</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {[
            { t: "Ask for a day pass", s: 'Almost every gym has one. Say "I\'m looking at joining, can I try it today?" That\'s the whole script.' },
            { t: "Bring the box", s: "If a gym handed you a First Timer box, they already know the program. Show the card." },
            { t: "Switch the program", s: 'Under Training preferences, set "Where you train" to gym. Your history stays.' },
          ].map((r, i) => (
            <View key={r.t} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{r.t}</Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>{r.s}</Text>
            </View>
          ))}
        </Card>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.ghostBtn, { borderColor: colors.line }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            const next = isGym ? "home_db" : "gym";
            appState.updateProfile({ where: next });
            appState.setActive(null);
          }}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
            {isGym ? "Switch to a home program" : "Switch my program to the gym"}
          </Text>
        </TouchableOpacity>
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
  input: { borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 6 },
  note: { fontSize: 12, lineHeight: 17 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  infoRow: { padding: 14 },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  ghostBtn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center", marginTop: spacing.lg },
});
