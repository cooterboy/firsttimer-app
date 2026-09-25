import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";

export default function ProgressScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Progress</Text>
        <Text style={[styles.note, { color: colors.muted }]}>
          {appState.history.length} session{appState.history.length === 1 ? "" : "s"} logged so far.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  title: { fontSize: type.displayPageTitle, letterSpacing: 0.5, marginBottom: 14 },
  note: { fontSize: 14 },
});
