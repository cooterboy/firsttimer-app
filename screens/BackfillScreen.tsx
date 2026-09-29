import React, { useState } from "react";
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { BLOCK_SESSIONS, unit } from "../lib/gymProgram";
import { buildBackfillEntry, buildSessionForProfile } from "../lib/sessionEngine";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0); // noon, so timezone shifts never bump it to a different calendar day
  d.setDate(d.getDate() - n);
  return d;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function BackfillScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const { block, session, profile, movementBank } = appState;

  const [date, setDate] = useState(daysAgo(1));
  const [showPicker, setShowPicker] = useState(false);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (session >= BLOCK_SESSIONS) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
        <TopBar colors={colors} onBack={() => navigation.goBack()} />
        <View style={styles.scroll}>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Block {block} is full. Start the next block, then add it there.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const built = buildSessionForProfile(movementBank, block, session, profile);
  const real = built.moves;
  const u = unit(profile.units);

  const submit = () => {
    Keyboard.dismiss();
    // Compare calendar dates, not exact timestamps — date is normalized to noon, so a
    // straight ">" against the live clock would wrongly reject "today" before noon.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const picked = new Date(date);
    picked.setHours(0, 0, 0, 0);
    if (picked > today) {
      Alert.alert("That day hasn't happened yet.");
      return;
    }
    setSubmitting(true);
    const entry = buildBackfillEntry(movementBank, block, session, profile, date, weights);
    appState.commitBackfill(entry);
    setSubmitting(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert("Added", "It counts the same.", [{ text: "OK", onPress: () => navigation.goBack() }]);
  };

  const quickOptions = [
    { label: "Yesterday", d: daysAgo(1) },
    { label: "2 days ago", d: daysAgo(2) },
    { label: "3 days ago", d: daysAgo(3) },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <TopBar colors={colors} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lede, { color: colors.ink2 }]}>
          Trained and never opened the app? Put it in. It counts like any other session and your next one prefills
          from it.
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.muted }]}>WHEN WAS IT</Text>
        <View style={styles.pillWrap}>
          {quickOptions.map((o) => {
            const on = sameDay(date, o.d);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                key={o.label}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setDate(o.d);
                }}
                style={[styles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised }]}
              >
                <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity activeOpacity={0.7} style={[styles.dateBtn, { borderColor: colors.line }]} onPress={() => setShowPicker(true)}>
          <Text style={{ color: colors.ink, fontSize: 14 }}>
            {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={{ color: colors.accent, fontSize: 13, fontFamily: fonts.bodySemiBold }}>Change</Text>
        </TouchableOpacity>
        {showPicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onChange={(_event, selected) => {
              setShowPicker(false);
              if (selected) {
                const d = new Date(selected);
                d.setHours(12, 0, 0, 0);
                setDate(d);
              }
            }}
          />
        ) : null}

        <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: spacing.lg }]}>
          SESSION {session + 1} · {built.letter}
        </Text>
        <Text style={[styles.note, { color: colors.muted }]}>
          Week {built.week}. This is the session you were up to, so it's the one that gets logged. Leave anything
          blank you can't remember — blank still counts as done.
        </Text>
        {real.map((m, i) => (
          <View key={m.n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodySemiBold }}>{m.n}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, fontFamily: fonts.mono }}>{m.spec}</Text>
            </View>
            {m.type === "weight" ? (
              <TextInput
                value={weights[m.n] || ""}
                onChangeText={(v) => setWeights((w) => ({ ...w, [m.n]: v }))}
                keyboardType="decimal-pad"
                placeholder={u}
                placeholderTextColor={colors.muted}
                style={[styles.weightInput, { color: colors.ink, backgroundColor: colors.sunken }]}
              />
            ) : (
              <View style={[styles.noWeightBadge, { backgroundColor: colors.sunken }]}>
                <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>no weight</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity activeOpacity={0.7}
          disabled={submitting}
          style={[styles.primary, { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 }]}
          onPress={submit}
        >
          <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Log it</Text>
        </TouchableOpacity>
        <Text style={[styles.note, { color: colors.muted, textAlign: "center", marginTop: 10 }]}>
          You can change or delete it afterwards under Every session.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ colors, onBack }: { colors: ReturnType<typeof useTheme>["colors"]; onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Add a session</Text>
      <View style={styles.backBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  lede: { fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  note: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  dateBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 11, padding: 13 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  weightInput: { width: 82, textAlign: "right", padding: 10, borderRadius: 9, fontSize: 15 },
  noWeightBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  primary: { borderRadius: 13, padding: 16, alignItems: "center", marginTop: spacing.lg },
});
