import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { parseBoxCode } from "../lib/shopContent";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import NutritionCard from "../components/NutritionCard";
import Sheet from "../components/workout/Sheet";

// Ports the prototype's renderShop() (spec/prototype.html:2907-2954) for the
// box-code/referral/recovery-tips parts, which aren't data-driven. The gear and
// box-reorder lists are content-as-data (migration 012's shop_items table) instead
// of the prototype's hardcoded GEAR/SLOTS — see lib/shopContent.ts's header comment.
// Simple list, not a grid: no browsing/filtering, just a short curated list.
export default function ShopScreen() {
  const { colors, category } = useTheme();
  const appState = useAppState();
  const [boxIn, setBoxIn] = useState("");
  const [boxErr, setBoxErr] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [openGear, setOpenGear] = useState<string | null>(null);

  const linkBox = () => {
    const parsed = parseBoxCode(boxIn);
    if (!parsed) {
      setBoxErr("Codes look like FT-REF-01-0042.");
      return;
    }
    setBoxErr("");
    appState.updateProfile({ boxCode: parsed.code });
  };

  const referralCode = "FT-" + (appState.profile.name || "FRIEND").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  const copyReferral = async () => {
    await Clipboard.setStringAsync(referralCode);
    Haptics.selectionAsync().catch(() => {});
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy"), 1800);
  };

  const categoryItems = appState.shopItems.filter((i) => i.category === category.key);
  const boxItems = categoryItems.filter((i) => i.section === "in_your_box").sort((a, b) => a.sortOrder - b.sortOrder);
  const gearItems = categoryItems.filter((i) => i.section === "gear").sort((a, b) => a.sortOrder - b.sortOrder);
  const gear = openGear ? gearItems.find((g) => g.id === openGear) || null : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: colors.ink, fontFamily: fonts.display }]}>Shop</Text>

        <Card>
          {appState.profile.boxCode ? (
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Your box</Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>{appState.profile.boxCode}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.warnSoft }]}>
                <Text style={{ color: colors.warn, fontSize: 11, fontFamily: fonts.bodyBold }}>Not yet connected</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Got a First Timer box?</Text>
              <Text style={[styles.note, { color: colors.muted }]}>
                Enter the code on the sticker inside the lid. It unlocks your sample reorder discounts.
              </Text>
              <View style={styles.codeRow}>
                <TextInput
                  value={boxIn}
                  onChangeText={setBoxIn}
                  placeholder="FT-REF-01-0042"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.muted}
                  style={[styles.codeInput, { color: colors.ink, backgroundColor: colors.sunken, fontFamily: fonts.mono }]}
                />
                <TouchableOpacity activeOpacity={0.7} style={[styles.inlineBtn, { backgroundColor: colors.accent }]} onPress={linkBox}>
                  <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 13 }}>Unlock</Text>
                </TouchableOpacity>
              </View>
              {boxErr ? <Text style={{ color: colors.bad, fontSize: 12, marginTop: 6 }}>{boxErr}</Text> : null}
              <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL("https://firsttimer.co")} style={[styles.ghostBtn, { borderColor: colors.line, marginTop: 14 }]}>
                <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Get the box at firsttimer.co</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {appState.profile.boxCode ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Your samples</Text>
            <Text style={[styles.note, { color: colors.muted }]}>
              Liked one? The reorder discount lives here, not on the box, so it works even if a brand changes.
            </Text>
            {boxItems.length ? (
              boxItems.map((s, i) => (
                <View key={s.id} style={[styles.slotRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                  <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{s.name}</Text>
                  <Text style={[styles.moveCue, { color: colors.muted }]}>{s.blurb}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.placeholder, { color: colors.muted }]}>Reorder items aren't set up yet — check back soon.</Text>
            )}
          </Card>
        ) : null}

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>GEAR, WHEN YOU'RE READY</Text>
        {gearItems.length ? (
          <Card style={{ padding: 0 }}>
            {gearItems.map((g, i) => (
              <TouchableOpacity
                key={g.id}
                activeOpacity={0.7}
                style={[styles.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
                onPress={() => setOpenGear(g.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{g.name}</Text>
                  <Text style={[styles.moveCue, { color: colors.muted }]} numberOfLines={2}>
                    {g.blurb}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={[styles.placeholder, { color: colors.muted }]}>Gear picks aren't set up yet — check back soon.</Text>
          </Card>
        )}
        <Text style={[styles.note, { color: colors.muted, marginTop: 6 }]}>
          These are affiliate links: First Timer earns a commission if you buy, at no extra cost to you. It's what
          keeps the first block free. Nothing here is required for the program.
        </Text>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>RECOVERY, IN FOUR LINES</Text>
        <NutritionCard />

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>BRING A FRIEND</Text>
        <Card>
          <Text style={[styles.note, { color: colors.muted, marginBottom: 8 }]}>
            They get their first paid block free. So do you.
          </Text>
          <View style={styles.codeRow}>
            <View style={[styles.codeBox, { backgroundColor: colors.sunken }]}>
              <Text style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 14 }}>{referralCode}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7} style={[styles.inlineBtn, { borderWidth: 1, borderColor: colors.line }]} onPress={copyReferral}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{copyLabel}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      <Sheet visible={openGear !== null} onClose={() => setOpenGear(null)}>
        {gear ? (
          <>
            <Text style={[styles.sheetTitle, { color: colors.ink, fontFamily: fonts.display }]}>{gear.name}</Text>
            <Text style={[styles.sheetBody, { color: colors.ink2 }]}>{gear.blurb}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.primary, { backgroundColor: colors.accent }]}
              onPress={() => {
                setOpenGear(null);
                if (gear.link) Linking.openURL(gear.link);
                else Alert.alert("Coming soon", "Partner links go live once the affiliate accounts are approved.");
              }}
            >
              <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Open partner store</Text>
            </TouchableOpacity>
            {!gear.link ? (
              <Text style={[styles.note, { color: colors.muted, marginTop: 12 }]}>
                Partner links go live once the affiliate accounts are approved.
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: type.displayPageTitle, letterSpacing: 0.5, marginBottom: spacing.md },
  sub: { fontSize: 17, marginBottom: 4 },
  note: { fontSize: 12, lineHeight: 17 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2 },
  codeRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  codeInput: { flex: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, textTransform: "uppercase" },
  codeBox: { flex: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 12 },
  inlineBtn: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16 },
  ghostBtn: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  slotRow: { paddingVertical: 10 },
  placeholder: { fontSize: 11, fontStyle: "italic", marginTop: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  sheetTitle: { fontSize: 22, letterSpacing: 0.5, marginBottom: 8 },
  sheetBody: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
});
