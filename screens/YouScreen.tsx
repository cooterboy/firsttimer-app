import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";

// Stopgap until the full Account/Settings screens land (task 26/27) — just enough
// to sign out and reset test data while the rest of You is being built.
export default function YouScreen() {
  const { colors } = useTheme();
  const appState = useAppState();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>
          {appState.profile.name || "You"}
        </Text>
        <Text style={[styles.note, { color: colors.muted, marginBottom: spacing.lg }]}>{appState.userEmail}</Text>

        <TouchableOpacity style={[styles.btn, { borderColor: colors.bad }]} onPress={() => appState.signOut()}>
          <Text style={{ color: colors.bad, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Sign out</Text>
        </TouchableOpacity>

        {__DEV__ ? (
          <>
            <TouchableOpacity
              style={[styles.btn, { borderColor: colors.line, marginTop: spacing.sm }]}
              onPress={() => appState.resetTestData()}
            >
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
                Reset test data (dev only)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { borderColor: colors.line, marginTop: spacing.sm }]}
              onPress={() => appState.devSeedNearBlockEnd()}
            >
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
                Seed to session 24 (dev only)
              </Text>
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
  title: { fontSize: type.displayPageTitle, letterSpacing: 0.5, marginBottom: 6 },
  note: { fontSize: 14 },
  btn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center" },
});
