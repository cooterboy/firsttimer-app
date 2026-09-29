import React from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { NETWORKS } from "../lib/shopContent";
import Card from "../components/Card";

// Ports the prototype's SUB.social (spec/prototype.html:3218-3223) — even there,
// "connecting" is just a switch that remembers your choice; no real OAuth exists
// in the prototype either.
export default function ConnectedAccountsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const social = appState.connectedAccounts;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Connected accounts</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.lede, { color: colors.ink2 }]}>
          Connect an account and it shows up as a one-tap option on the share sheet after every session. Nothing
          posts on its own.
        </Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {NETWORKS.map((n, i) => {
            const on = !!social[n.k];
            return (
              <View key={n.k} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodyMedium }]}>{n.n}</Text>
                  <Text style={[styles.moveCue, { color: colors.muted }]}>{on ? "Connected" : "Not connected"}</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={() => {
                    Haptics.selectionAsync().catch(() => {});
                    appState.toggleConnectedAccount(n.k);
                  }}
                />
              </View>
            );
          })}
        </Card>
        <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>
          In the App Store version, connecting opens the app's own sign-in. Here the switch just remembers your
          choice.
        </Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2 },
  note: { fontSize: 12, lineHeight: 17 },
});
