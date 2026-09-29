import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { fmtDate } from "../lib/sessionEngine";
import Card from "../components/Card";

// Ports the prototype's SUB.friends (spec/prototype.html:3225-3249). Fully local —
// no real backend, no notifications to the other person, no verification that an
// added code belongs to a real account. The example feed is the prototype's own
// EXAMPLE_FRIENDS, kept clearly labeled "Example:" rather than removed, since the
// prototype itself frames these as illustrative, not real people.
const EXAMPLE_FRIENDS = [
  { name: "Example: Jordan", item: "finished session 7", stat: "Leg press up to 140 lb", when: "2 h ago" },
  { name: "Example: Priya", item: "logged week 3, 3 of 3", stat: "4,200 lb moved this week", when: "Yesterday" },
  { name: "Example: Marcus", item: "started block 2", stat: "24 sessions done", when: "Mon" },
];

export default function FriendsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const friendsOptIn = appState.profile.friendsOptIn;
  const friendsList = appState.friends;
  const [addIn, setAddIn] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");

  const myCode = "FT-" + (appState.profile.name || "YOU").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);

  const copyCode = async () => {
    await Clipboard.setStringAsync(myCode);
    Haptics.selectionAsync().catch(() => {});
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy"), 1800);
  };

  const addFriend = () => {
    const v = addIn.trim().toUpperCase();
    if (v.length < 5) return;
    const bare = v.replace(/^FT-/, "");
    const name = bare.charAt(0) + bare.slice(1).toLowerCase();
    appState.commitFriend({ id: Crypto.randomUUID(), name, code: v, bumped: false, date: new Date().toISOString() });
    setAddIn("");
    Alert.alert("Added.", "They'll see you once they accept.");
  };

  const toggleBump = (code: string) => {
    Haptics.selectionAsync().catch(() => {});
    appState.toggleFriendBump(code);
  };

  const feed = friendsList.length
    ? friendsList.map((x) => ({ name: x.name, code: x.code, item: "joined", stat: "No sessions yet", when: fmtDate(x.date), bumped: x.bumped }))
    : EXAMPLE_FRIENDS.map((x, i) => ({ ...x, code: `example-${i}`, bumped: false }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Friends</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                Share my activity with friends
              </Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>
                Sessions done, weeks completed, and lifts that went up. Never your body weight.
              </Text>
            </View>
            <Switch
              value={friendsOptIn}
              onValueChange={(v) => {
                Haptics.selectionAsync().catch(() => {});
                appState.updateProfile({ friendsOptIn: v });
              }}
            />
          </View>
        </Card>

        {!friendsOptIn ? (
          <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>
            Off by default. Turn it on and friends who add your code see your sessions. You see theirs.
          </Text>
        ) : (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>YOUR CODE</Text>
            <Card>
              <View style={styles.codeRow}>
                <View style={[styles.codeBox, { backgroundColor: colors.sunken }]}>
                  <Text style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 14 }}>{myCode}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.7} style={[styles.inlineBtn, { borderWidth: 1, borderColor: colors.line }]} onPress={copyCode}>
                  <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{copyLabel}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>Send it to a friend. They add it below on their phone.</Text>
            </Card>

            <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>ADD A FRIEND</Text>
            <Card>
              <View style={styles.codeRow}>
                <TextInput
                  value={addIn}
                  onChangeText={setAddIn}
                  placeholder="FT-XXXXXX"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.muted}
                  style={[styles.codeInput, { color: colors.ink, backgroundColor: colors.sunken, fontFamily: fonts.mono }]}
                />
                <TouchableOpacity activeOpacity={0.7} style={[styles.inlineBtn, { backgroundColor: colors.accent }]} onPress={addFriend}>
                  <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 13 }}>Add</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>THIS WEEK</Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {feed.map((x, i) => {
                const initials = x.name.replace("Example: ", "").slice(0, 2).toUpperCase();
                const on = x.bumped;
                return (
                  <View key={x.code} style={[styles.friendRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.sunken }]}>
                      <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 13 }}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                        {x.name} {x.item}
                      </Text>
                      <Text style={[styles.moveCue, { color: colors.muted }]}>
                        {x.stat} · {x.when}
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[styles.bumpBtn, { borderColor: on ? colors.accent : colors.line }, on && { backgroundColor: colors.accentSoft }]}
                      onPress={() => toggleBump(x.code)}
                    >
                      <Text style={{ color: on ? colors.accentDeep : colors.ink, fontSize: 12, fontFamily: fonts.bodyBold }}>
                        {on ? "Bumped" : "Fist bump"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Card>
            {!friendsList.length ? (
              <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>
                Examples until a friend joins. Fist bumps are the only reaction, on purpose.
              </Text>
            ) : null}
          </>
        )}
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
  rowBetween: { flexDirection: "row", alignItems: "flex-start" },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  note: { fontSize: 12, lineHeight: 17 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  codeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  codeBox: { flex: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 12 },
  codeInput: { flex: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, textTransform: "uppercase" },
  inlineBtn: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16 },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bumpBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
});
