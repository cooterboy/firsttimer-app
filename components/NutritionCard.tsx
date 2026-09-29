import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { fonts } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { nutritionCard } from "../lib/sessionEngine";
import Card from "./Card";

// Ports the prototype's "Recovery, in four lines" card (spec/prototype.html:2945-2950,
// inside renderShop) — lives on the Shop tab there, not Account.
function NutritionRow({ k, sub, v }: { k: string; sub: string; v: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.nutRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium }}>{k}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{sub}</Text>
      </View>
      <Text style={{ color: colors.ink, fontFamily: fonts.monoBold, fontSize: 14 }}>{v}</Text>
    </View>
  );
}

export default function NutritionCard() {
  const { colors } = useTheme();
  const appState = useAppState();
  const n = nutritionCard(appState.profile);
  return (
    <Card>
      <NutritionRow k="Protein" sub="Every day, spread over meals. Not just training days." v={n.protein} />
      <NutritionRow k="Water" sub="More on training days. Pale yellow is the check." v={n.water} />
      <NutritionRow k="Calories" sub={n.calorieSub} v={n.calorieLine} />
      <NutritionRow k="Sleep" sub="The workout is the stimulus. Sleep is where the change happens." v="7–9 h" />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
        {n.hasData
          ? "Worked out from your weight, height and age above. Update them and these move with it."
          : "Fill in your weight, height and age above and these fill in for you."}{" "}
        A certified trainer signs off on the ranges.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  nutRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
});
