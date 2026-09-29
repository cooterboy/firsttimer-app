import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { fmtDate } from "../lib/sessionEngine";
import { PRICE_ONE, PRICE_THREE, ownedBlocks, productFor } from "../lib/blockCatalog";
import { isPurchasesConfigured, purchaseRecord, restoreBlockProducts } from "../lib/purchases";
import Card from "../components/Card";

// Ports the prototype's SUB.subscription (spec/prototype.html:3129-3139). "Restore
// purchases" asks the store which block products this account owns (see
// lib/purchases.ts's restoreBlockProducts()) and commits any not already in
// appState.purchases, each unlocking its own specific blocks (lib/blockCatalog.ts)
// — covers a reinstall, a new device signed into the same store account before ever
// signing into this app's account, or a Supabase write that failed at the time of
// the original purchase.
export default function PurchasesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const owned = ownedBlocks(appState.purchases);
  const [restoring, setRestoring] = useState(false);

  const onRestore = async () => {
    if (!isPurchasesConfigured) {
      Alert.alert("Not available yet", "Purchases aren't connected on this build.");
      return;
    }
    setRestoring(true);
    try {
      const storeOwned = await restoreBlockProducts();
      const known = new Set(appState.purchases.map((p) => p.productId).filter(Boolean));
      const missing = storeOwned.filter((o) => !known.has(o.productId));
      if (!missing.length) {
        Alert.alert("Nothing to restore", "Every purchase on this account is already unlocked here.");
        return;
      }
      for (const o of missing) {
        const product = productFor(o.productId);
        if (product) appState.commitPurchase(await purchaseRecord(appState.userId, product, o.date));
      }
      Alert.alert("Restored", `${missing.length} purchase${missing.length === 1 ? "" : "s"} added back.`);
    } catch (e) {
      console.warn("Restore failed:", e);
      Alert.alert("Couldn't restore", "Check your connection and try again.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Purchases</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Current plan</Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>
                {owned > 1 ? `Blocks 1–${owned} unlocked` : "Block 1, free. No card on file."}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: owned > 1 ? colors.goodSoft : colors.sunken }]}>
              <Text style={{ color: owned > 1 ? colors.good : colors.muted, fontSize: 11, fontFamily: fonts.bodyBold }}>
                {owned > 1 ? "Paid" : "Free"}
              </Text>
            </View>
          </View>
        </Card>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>HOW IT WORKS</Text>
        <Card>
          {[
            "Block 1 is free with no card required.",
            `Every block after is a one-time $${PRICE_ONE}, or three for $${PRICE_THREE}.`,
            "No subscription. Nothing renews. Nothing to cancel.",
            "Paid blocks stay yours on every device you sign in on.",
          ].map((line) => (
            <View key={line} style={styles.checkRow}>
              <Text style={{ color: colors.good, marginRight: 8 }}>✓</Text>
              <Text style={{ color: colors.ink2, fontSize: 13, flex: 1, lineHeight: 19 }}>{line}</Text>
            </View>
          ))}
          <TouchableOpacity activeOpacity={0.8} style={[styles.primary, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate("Plans")}>
            <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>See plans</Text>
          </TouchableOpacity>
        </Card>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>RECEIPTS</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {appState.purchases.length ? (
            appState.purchases.map((p, i) => (
              <View key={p.id} style={[styles.receiptRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View>
                  <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{p.label}</Text>
                  <Text style={[styles.moveCue, { color: colors.muted }]}>{fmtDate(p.date)}</Text>
                </View>
                <Text style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 13 }}>${p.price}</Text>
              </View>
            ))
          ) : (
            <View style={styles.receiptRow}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>No purchases yet.</Text>
            </View>
          )}
        </Card>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={restoring}
          style={[styles.ghostBtn, { borderColor: colors.line, opacity: restoring ? 0.6 : 1 }]}
          onPress={onRestore}
        >
          {restoring ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Restore purchases</Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>
          Purchases are handled by the App Store or Google Play. Refunds go through them, not through us.
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
  rowBetween: { flexDirection: "row", alignItems: "center" },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  ghostBtn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center", marginTop: spacing.lg },
  note: { fontSize: 12, lineHeight: 17 },
});
