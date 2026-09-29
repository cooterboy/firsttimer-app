import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { weekOf, weeksPerBlock } from "../lib/gymProgram";

// The prototype's persistent top bar (logo/week bar, streak badge, avatar) — shown
// the same way at the top of both Today and Progress.
export default function AppHeader() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const total = weeksPerBlock();
  const weekFilled = weekOf(appState.session) - 1;
  const initials = (appState.profile.name || "FT").slice(0, 2).toUpperCase();

  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.logoWord, { color: colors.ink, fontFamily: fonts.display }]}>
          FIRST <Text style={{ color: colors.accent, fontFamily: fonts.display }}>TIMER</Text>
        </Text>
        <View style={styles.logoBar}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.logoBarSeg, { backgroundColor: i < weekFilled ? colors.accent : colors.line }]} />
          ))}
        </View>
      </View>
      <View style={styles.hdrRight}>
        {appState.streak > 0 ? (
          <View style={[styles.streakBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 }}>
              {appState.streak} in a row
            </Text>
          </View>
        ) : null}
        <TouchableOpacity activeOpacity={0.7} style={[styles.avatar, { backgroundColor: colors.ink }]} onPress={() => navigation.navigate("You")}>
          <Text style={[styles.avatarText, { color: colors.paper, fontFamily: fonts.display }]}>{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logoWord: { fontSize: type.displayWord, letterSpacing: 0.5 },
  logoBar: { flexDirection: "row", gap: 3, marginTop: 5 },
  logoBarSeg: { width: 9, height: 4, borderRadius: 2 },
  hdrRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  streakBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, letterSpacing: 0.5 },
});
