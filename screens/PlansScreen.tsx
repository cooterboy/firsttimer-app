import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { PurchasesPackage } from "react-native-purchases";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { fmtDate, retestSummary } from "../lib/sessionEngine";
import { PRICE_ONE, PRICE_THREE, ownedBlocks, unit, weeksPerBlock } from "../lib/gymProgram";
import { BLOCKS_GRANTED, buyBlockPackage, getBlockPackages, isPurchasesConfigured, isUserCancelled } from "../lib/purchases";
import Card from "../components/Card";

// Ports the prototype's SUB.paywall + paywallProof() (spec/prototype.html:3141-3184).
// "Buy" is a real RevenueCat purchase (see lib/purchases.ts) for two one-time,
// non-renewing products — block_single and block_bundle_three — that map straight
// onto appState.commitPurchase(), same as the __DEV__-only unlock button below
// always did. That dev button stays: it's still the fastest way to test block-gating
// UI without an App Store sandbox account.
export default function PlansScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const [pick, setPick] = useState<1 | 3>(1);
  const [packages, setPackages] = useState<{ single: PurchasesPackage | null; bundle: PurchasesPackage | null }>({
    single: null,
    bundle: null,
  });
  const [buying, setBuying] = useState(false);

  const { history, profile, purchases, session } = appState;
  const wpb = weeksPerBlock(appState.program.blockSessions);
  const owned = ownedBlocks(purchases);
  const u = unit(profile.units);
  const proof = history.length >= 6 ? retestSummary(history, profile.units) : null;

  useEffect(() => {
    if (!isPurchasesConfigured) return;
    getBlockPackages()
      .then(setPackages)
      .catch((e) => console.warn("Couldn't load block offerings:", e));
  }, []);

  const doUnlock = (blocks: number, price: number, purchaseId?: string) => {
    appState.commitPurchase({
      id: purchaseId || Crypto.randomUUID(),
      label: blocks === 3 ? `Blocks ${owned + 1}–${owned + blocks}` : `Block ${owned + 1}`,
      price,
      blocks,
      date: new Date().toISOString(),
    });
    if (session >= 24) appState.advanceBlock();
    Alert.alert("Unlocked", "Same time next session.");
    navigation.goBack();
  };

  const buy = async () => {
    const pkg = pick === 3 ? packages.bundle : packages.single;
    if (!isPurchasesConfigured || !pkg) {
      Alert.alert(
        "Not available yet",
        "Purchases aren't connected on this build — see the __DEV__ unlock below to keep testing."
      );
      return;
    }
    setBuying(true);
    try {
      const txn = await buyBlockPackage(pkg);
      const blocks = BLOCKS_GRANTED[pkg.product.identifier] ?? pick;
      const price = pick === 3 ? PRICE_THREE : PRICE_ONE;
      doUnlock(blocks, price, txn?.transactionIdentifier);
    } catch (e) {
      if (!isUserCancelled(e)) {
        Alert.alert("Purchase failed", "Something went wrong on the store's end. Try again in a moment.");
      }
    } finally {
      setBuying(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Plans</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {proof ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>WHAT YOU BUILT</Text>
            <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>
              {proof.weeks} week{proof.weeks === 1 ? "" : "s"}. {proof.sessions} session{proof.sessions === 1 ? "" : "s"}.
            </Text>
            <Text style={[styles.lede, { color: colors.ink2 }]}>
              Since {fmtDate(proof.firstDate)}.{" "}
              {proof.liftsUp ? `${proof.liftsUp} of your lifts went up and none of it came from anywhere but you showing up.` : "Every one of them logged."}
            </Text>
            <View style={styles.tiles}>
              <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
                <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{proof.sessions}</Text>
                <Text style={[styles.tileLabel, { color: colors.muted }]}>Sessions</Text>
              </View>
              <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
                <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{proof.liftsUp}</Text>
                <Text style={[styles.tileLabel, { color: colors.muted }]}>Lifts up</Text>
              </View>
              <View style={[styles.tile, { backgroundColor: colors.sunken }]}>
                <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{proof.movedLabel}</Text>
                <Text style={[styles.tileLabel, { color: colors.muted }]}>{u} moved</Text>
              </View>
            </View>
            {proof.rows.length ? (
              <Card>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>WEEK ONE AGAINST NOW</Text>
                {proof.rows.map((r) => (
                  <View key={r.name} style={styles.compareRow}>
                    <Text style={[styles.compareCell, { color: colors.ink, flex: 1.4 }]}>{r.name}</Text>
                    <Text style={[styles.compareCell, { color: colors.muted, fontFamily: fonts.mono, flex: 1, textAlign: "right" }]}>{r.first}</Text>
                    <Text style={[styles.compareCell, { color: colors.ink, fontFamily: fonts.monoBold, flex: 1, textAlign: "right" }]}>
                      {r.last}
                      {r.pct > 0 ? <Text style={{ color: colors.good, fontSize: 12 }}> +{r.pct}%</Text> : null}
                    </Text>
                  </View>
                ))}
                <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>Your first logged weight against your latest, in {u}.</Text>
              </Card>
            ) : null}
            <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
                <Text style={{ fontFamily: fonts.bodyBold }}>Every one of those numbers carries into block {owned + 1}.</Text>{" "}
                Same movements, heavier, and the app keeps prefilling from where you actually are.
              </Text>
            </View>
            <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>WHAT'S NEXT</Text>
            <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Block {owned + 1}</Text>
            <Text style={[styles.lede, { color: colors.ink2 }]}>
              Heavier, eight reps instead of ten, and a retest at the end so you get another one of those tables.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display, marginTop: 8 }]}>Keep going.</Text>
            <Text style={[styles.lede, { color: colors.ink2 }]}>
              Block {owned + 1} picks up where block {owned} ends: same movements, heavier, another retest.
            </Text>
          </>
        )}

        <PlanButton
          colors={colors}
          selected={pick === 1}
          price={PRICE_ONE}
          priceLabel={packages.single?.product.priceString}
          title={`Block ${owned + 1}`}
          detail={`${wpb} weeks. Pay again only if you want the next one.`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setPick(1);
          }}
        />
        <PlanButton
          colors={colors}
          selected={pick === 3}
          price={PRICE_THREE}
          priceLabel={packages.bundle?.product.priceString}
          title={`Blocks ${owned + 1}–${owned + 3}`}
          detail={`About ${wpb * 3} weeks. Save $${PRICE_ONE * 3 - PRICE_THREE} against one at a time.`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setPick(3);
          }}
        />

        {[
          "No subscription, nothing renews",
          "Every movement video, swap, and rest timer",
          "Your history and retest numbers carry over",
          "Cancel nothing, because there's nothing to cancel",
        ].map((line) => (
          <View key={line} style={styles.checkRow}>
            <Text style={{ color: colors.good, marginRight: 8 }}>✓</Text>
            <Text style={{ color: colors.ink2, fontSize: 13, flex: 1, lineHeight: 19 }}>{line}</Text>
          </View>
        ))}
        <Text style={[styles.note, { color: colors.muted, marginTop: 6 }]}>
          One session with a trainer costs more than this does, and this is eight weeks of them.
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={buying}
          style={[styles.primary, { backgroundColor: colors.accent, marginTop: 14, opacity: buying ? 0.7 : 1 }]}
          onPress={buy}
        >
          {buying ? (
            <ActivityIndicator color={colors.accentInk} />
          ) : (
            <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>
              {pick === 3
                ? `Buy three blocks for ${packages.bundle?.product.priceString || `$${PRICE_THREE}`}`
                : `Buy block ${owned + 1} for ${packages.single?.product.priceString || `$${PRICE_ONE}`}`}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.ink2, fontSize: 14, fontFamily: fonts.bodySemiBold }}>Not now</Text>
        </TouchableOpacity>
        <Text style={[styles.note, { color: colors.muted, textAlign: "center" }]}>
          {proof ? "Nothing you've logged goes away if you don't. It's all still under Progress." : "Billed once through the App Store."}
        </Text>

        {__DEV__ ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.xl }]}>DEV ONLY</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.devBtn, { borderColor: colors.line }]}
              onPress={() => doUnlock(pick, pick === 3 ? PRICE_THREE : PRICE_ONE)}
            >
              <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
                Unlock {pick === 3 ? "3 blocks" : "1 block"} (dev, no charge)
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanButton({
  colors,
  selected,
  price,
  priceLabel,
  title,
  detail,
  onPress,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  selected: boolean;
  price: number;
  priceLabel?: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.planBtn, { borderColor: selected ? colors.accent : colors.line, backgroundColor: selected ? colors.accentSoft : colors.raised }]}
    >
      <View>
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 22 }}>{priceLabel || `$${price}`}</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>one time</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{detail}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 4 },
  big: { fontSize: 28, letterSpacing: 0.5, marginBottom: 4 },
  sub: { fontSize: 22, marginBottom: 4 },
  lede: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tile: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  tileNum: { fontSize: 22, marginBottom: 2 },
  tileLabel: { fontSize: 11, textAlign: "center" },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 10 },
  compareRow: { flexDirection: "row", paddingVertical: 6 },
  compareCell: { fontSize: 13 },
  note: { fontSize: 12, lineHeight: 17 },
  banner: { borderRadius: 12, padding: 13, marginBottom: 14 },
  planBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 10 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  primary: { borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  ghostBtn: { alignItems: "center", paddingVertical: 12 },
  devBtn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center" },
});
