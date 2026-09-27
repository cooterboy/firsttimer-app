import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { fmtDate } from "../lib/sessionEngine";
import Card from "../components/Card";

function initials(name: string) {
  return (name || "FT").slice(0, 2).toUpperCase();
}

export default function YouScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const { profile, history, block } = appState;
  const since = history.length ? fmtDate(history[0].date) : "today";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}>
        <View style={styles.headRow}>
          <View style={[styles.bigAvatar, { backgroundColor: colors.ink }]}>
            <Text style={[styles.bigAvatarText, { color: colors.paper, fontFamily: fonts.display }]}>
              {initials(profile.name)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.display }]}>{profile.name || "You"}</Text>
            <Text style={[styles.sub, { color: colors.muted }]}>Gym · since {since}</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          <Card style={styles.tile}>
            <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{history.length}</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Sessions</Text>
          </Card>
          <Card style={styles.tile}>
            <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{block}</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Block</Text>
          </Card>
          <Card style={styles.tile}>
            <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>Free</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Plan</Text>
          </Card>
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>TRAINING</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <TouchableOpacity activeOpacity={0.7} style={styles.item} onPress={() => navigation.navigate("TrainingPreferences")}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                Training preferences
              </Text>
              <Text style={[styles.itemSub, { color: colors.muted }]}>Gym · Mon, Wed, Fri · {profile.length} min</Text>
            </View>
            <Text style={[styles.itemChev, { color: colors.muted }]}>›</Text>
          </TouchableOpacity>
        </Card>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>APP</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.item, { borderBottomWidth: 1, borderBottomColor: colors.line }]} onPress={() => navigation.navigate("Settings")}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Settings</Text>
              <Text style={[styles.itemSub, { color: colors.muted }]}>{profile.units === "metric" ? "kg" : "lb"} units</Text>
            </View>
            <Text style={[styles.itemChev, { color: colors.muted }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.item} onPress={() => navigation.navigate("Account")}>
            <Text style={[styles.itemTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Account</Text>
            <Text style={[styles.itemChev, { color: colors.muted }]}>›</Text>
          </TouchableOpacity>
        </Card>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>SUPPORT</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.item, { borderBottomWidth: 1, borderBottomColor: colors.line }]}
            onPress={() => navigation.navigate("Privacy")}
          >
            <Text style={[styles.itemTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Privacy policy</Text>
            <Text style={[styles.itemChev, { color: colors.muted }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.item, { borderBottomWidth: 1, borderBottomColor: colors.line }]}
            onPress={() => navigation.navigate("Terms")}
          >
            <Text style={[styles.itemTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Terms of use</Text>
            <Text style={[styles.itemChev, { color: colors.muted }]}>›</Text>
          </TouchableOpacity>
          <View style={[styles.item, { borderBottomWidth: 0 }]}>
            <Text style={[styles.itemTitle, { color: colors.muted, fontFamily: fonts.bodyMedium }]}>
              First Timer · v0.1
            </Text>
          </View>
        </Card>

        {__DEV__ ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>DEV ONLY</Text>
            <TouchableOpacity activeOpacity={0.7}
              style={[styles.btn, { borderColor: colors.line }]}
              onPress={async () => {
                await appState.resetTestData();
                Alert.alert("Reset", "Test data cleared. Switch to Today to see it.");
              }}
            >
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Reset test data</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}
              style={[styles.btn, { borderColor: colors.line, marginTop: spacing.sm }]}
              onPress={() => {
                appState.devSeedNearBlockEnd();
                Alert.alert("Seeded", "23 sessions seeded. Switch to Today — session 24 should be waiting.");
              }}
            >
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Seed to session 24</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: spacing.lg },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  bigAvatarText: { fontSize: 24, letterSpacing: 0.5 },
  name: { fontSize: type.displayPageTitle, letterSpacing: 0.5 },
  sub: { fontSize: 13, marginTop: 2 },
  tiles: { flexDirection: "row", gap: 10, marginBottom: spacing.lg },
  tile: { flex: 1, alignItems: "center", padding: 14 },
  tileNum: { fontSize: 28, lineHeight: 28 },
  tileLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginTop: 4 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "transparent" },
  itemTitle: { fontSize: 14 },
  itemSub: { fontSize: 12, marginTop: 2 },
  itemChev: { fontSize: 18 },
  btn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center" },
});
