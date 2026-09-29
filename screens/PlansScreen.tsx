import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { fmtDate, retestSummary } from "../lib/sessionEngine";
import { unit, weeksPerBlock } from "../lib/gymProgram";
import { BlockProduct, MAX_BLOCKS, PRICE_ONE, PRICE_THREE, nextOffers, ownedBlocks, productFor, productLabel } from "../lib/blockCatalog";
import { BlockOffer, buyBlockProduct, getNextOffers, isPurchasesConfigured, isUserCancelled, purchaseRecord } from "../lib/purchases";
import Card from "../components/Card";

// Ports the prototype's SUB.paywall + paywallProof() (spec/prototype.html:3141-3184).
// Sells what lib/blockCatalog.ts says comes next: the next block on its own, and —
// when a fixed bundle starts at that block (2–4, 5–7, 8–10) — that bundle. Both are
// non-consumable store products bought through RevenueCat (lib/purchases.ts) and
// committed as the same Purchase record the __DEV__-only unlock below writes. That
// dev button stays: it's still the fastest way to test block-gating UI without an
// App Store sandbox account. Once every block (MAX_BLOCKS) is owned there's nothing
// to sell, and the screen says so instead.
export default function PlansScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const appState = useAppState();
  const [pickBundle, setPickBundle] = useState(false);
  const [store, setStore] = useState<{ single: BlockOffer | null; bundle: BlockOffer | null }>({ single: null, bundle: null });
  const [buying, setBuying] = useState(false);

  const { history, profile, purchases, session } = appState;
  const wpb = weeksPerBlock(appState.program.blockSessions);
  const owned = ownedBlocks(purchases);
  const offers = nextOffers(owned);
  const pick = pickBundle && offers.bundle ? 3 : 1;
  const chosen: BlockProduct | null = pick === 3 ? offers.bundle : offers.single;
  const u = unit(profile.units);
  const proof = history.length >= 6 ? retestSummary(history, profile.units) : null;

  // Store packages (and localized prices) for whatever comes next — refetched
  // whenever ownership changes, since the next block and bundle change with it.
  useEffect(() => {
    if (!isPurchasesConfigured || owned >= MAX_BLOCKS) return;
    getNextOffers(owned)
      .then(setStore)
      .catch((e) => console.warn("Couldn't load block offerings:", e));
  }, [owned]);
  const chosenPkg = (pick === 3 ? store.bundle : store.single)?.pkg ?? null;

  const unlock = async (product: BlockProduct, date: string) => {
    appState.commitPurchase(await purchaseRecord(appState.userId, product, date));
    if (session >= appState.program.blockSessions) appState.advanceBlock();
    Alert.alert("Unlocked", "Same time next session.");
    navigation.goBack();
  };

  const buy = async () => {
    if (!chosen) return;
    if (!isPurchasesConfigured || !chosenPkg || chosenPkg.product.identifier !== chosen.id) {
      Alert.alert(
        "Not available yet",
        "Purchases aren't connected on this build — see the __DEV__ unlock below to keep testing."
      );
      return;
    }
    setBuying(true);
    try {
      const { productId, date } = await buyBlockProduct(chosenPkg);
      await unlock(productFor(productId) ?? chosen, date);
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
        {!chosen ? (
          <AllUnlocked colors={colors} onBack={() => navigation.goBack()} />
        ) : (
          <>
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
              priceLabel={store.single?.pkg?.product.priceString}
              title={`Block ${owned + 1}`}
              detail={`${wpb} weeks. Pay again only if you want the next one.`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPickBundle(false);
              }}
            />
            {offers.bundle ? (
              <PlanButton
                colors={colors}
                selected={pick === 3}
                price={PRICE_THREE}
                priceLabel={store.bundle?.pkg?.product.priceString}
                title={productLabel(offers.bundle)}
                detail={`About ${wpb * 3} weeks. Save ${PRICE_ONE * 3 - PRICE_THREE} against one at a time.`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPickBundle(true);
                }}
              />
            ) : null}

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
                    ? `Buy three blocks for ${store.bundle?.pkg?.product.priceString || `${PRICE_THREE}`}`
                    : `Buy block ${owned + 1} for ${store.single?.pkg?.product.priceString || `${PRICE_ONE}`}`}
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
                  onPress={() => chosen && unlock(chosen, new Date().toISOString())}
                >
                  <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
                    Unlock {pick === 3 ? "3 blocks" : "1 block"} (dev, no charge)
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Shown once every block is owned (MAX_BLOCKS) — nothing left to sell.
function AllUnlocked({ colors, onBack }: { colors: ReturnType<typeof useTheme>["colors"]; onBack: () => void }) {
  return (
    <>
      <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display, marginTop: 8 }]}>Every block is yours.</Text>
      <Text style={[styles.lede, { color: colors.ink2 }]}>
        All {MAX_BLOCKS} blocks of the gym program are unlocked. There's nothing else to buy.
      </Text>
      <TouchableOpacity activeOpacity={0.7} style={styles.ghostBtn} onPress={onBack}>
        <Text style={{ color: colors.ink2, fontSize: 14, fontFamily: fonts.bodySemiBold }}>Back</Text>
      </TouchableOpacity>
    </>
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
