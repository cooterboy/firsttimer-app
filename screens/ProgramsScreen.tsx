import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { useAppState } from "../lib/appState";
import {
  buildSession,
  daysPer,
  setsFor,
  unit,
  weekOf,
  weeksPerBlock,
} from "../lib/gymProgram";
import { lastFor } from "../lib/sessionEngine";
import { MAX_BLOCKS, PRICE_ONE, PRICE_THREE, nextOffers, ownedBlocks } from "../lib/blockCatalog";
import { WHERE_LABEL } from "../lib/types";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import Sheet from "../components/workout/Sheet";

// Ports the prototype's renderPrograms() (spec/prototype.html:2849-2904). One
// deliberate simplification: the prototype's program-switcher chips only ever
// affect what Today shows (which program's session engine is live) — Hyrox and
// Marathon have no real session-building logic in this app at all (only the gym
// bank is ported, per lib/gymProgram.ts's own header comment), so this screen
// doesn't build a chip-driven "current program" switch. Hyrox/Marathon get their
// real prototype treatment instead: the "Other first times" notify-me cards,
// driven by the `categories` table (migration 013) — adding a fourth category
// later is an INSERT there, not a code change here. Everything above those
// cards describes appState.program, the plan for where the person trains.
export default function ProgramsScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const { block, session, history, profile, purchases, notify, program } = appState;
  const [openMove, setOpenMove] = useState<string | null>(null);

  const wpb = weeksPerBlock(program.blockSessions);
  const days = daysPer();
  const wk = weekOf(session);
  const doneInBlock = history.filter((h) => h.block === block).length;
  const blockSessions = program.blockSessions;
  const blockPct = Math.round((doneInBlock / blockSessions) * 100);
  const owned = ownedBlocks(purchases);

  // One built session per template in the rotation (A, B, C for gym).
  const sessions = program.templates.map((_, i) => buildSession(program, block, i, profile.length, profile.reps, profile.pain));
  const sessionCount = ["no", "one", "two", "three", "four", "five", "six", "seven"][sessions.length] ?? String(sessions.length);
  const doneLetters: Record<string, number> = {};
  history.filter((h) => h.block === block).forEach((h) => {
    doneLetters[h.letter] = (doneLetters[h.letter] || 0) + 1;
  });

  const allMoves: Record<string, (typeof sessions)[number]["moves"][number]> = {};
  sessions.forEach((s) => s.moves.forEach((m) => (allMoves[m.n] = m)));
  const moveNames = Object.keys(allMoves);
  const openM = openMove ? allMoves[openMove] : null;
  const openLast = openMove ? lastFor(openMove, history) : null;

  const u = unit(profile.units);
  const totalBlocks = Math.min(MAX_BLOCKS, Math.max(4, block + 2));
  // Bundles cover fixed blocks (2–4, 5–7, 8–10), so there is only a "next three"
  // to offer when one starts at exactly the next unowned block.
  const bundle = nextOffers(owned).bundle;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: colors.ink, fontFamily: fonts.display }]}>Programs</Text>

        <Card>
          <View style={styles.rowTop}>
            <Text style={[styles.gymTitle, { color: colors.ink, fontFamily: fonts.display }]}>
              {program.name} · Block {block}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.sunken }]}>
              <Text style={{ color: colors.ink2, fontSize: 11, fontFamily: fonts.bodyBold }}>
                Week {wk} of {wpb}
              </Text>
            </View>
          </View>
          <Text style={[styles.gymSub, { color: colors.muted }]}>
            {WHERE_LABEL[profile.where]} · {days} days a week
          </Text>

          <View style={styles.progressLabelRow}>
            <Text style={{ color: colors.ink2, fontSize: 12, fontFamily: fonts.bodySemiBold }}>
              Session {Math.min(session + 1, blockSessions)} of {blockSessions}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{blockSessions - doneInBlock} to go</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.sunken }]}>
            <View style={[styles.fill, { backgroundColor: colors.accent, width: `${blockPct}%` }]} />
          </View>

          <View style={{ marginTop: spacing.md }}>
            {Array.from({ length: wpb }).map((_, i) => {
              const w = i + 1;
              const cells = [];
              for (let dd = 0; dd < days; dd++) {
                const idx = (w - 1) * days + dd;
                if (idx >= blockSessions) break;
                const done = history.some((h) => h.block === block && h.idx === idx);
                cells.push({ done, now: idx === session });
              }
              const right =
                w < wk ? "done" : w === wk ? "in progress" : w === 1 ? "learn" : w === wpb ? "retest" : `${setsFor(block, w, profile.length)} sets`;
              return (
                <View key={w} style={styles.weekRow}>
                  <Text style={[styles.weekLabel, { color: colors.muted }]}>Wk {w}</Text>
                  <View style={styles.weekCells}>
                    {cells.map((c, ci) => (
                      <View
                        key={ci}
                        style={[
                          styles.weekCell,
                          { backgroundColor: colors.sunken },
                          c.done && { backgroundColor: colors.good },
                          c.now && !c.done && { backgroundColor: colors.accent },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.weekRight, { color: w === wk ? colors.ink : colors.muted }]}>{right}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>This program</Text>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{blockPct}%</Text>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Block {block}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{history.length}</Text>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Sessions {history.length === 0 ? "logged" : "ever"}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={[styles.tileNum, { color: colors.ink, fontFamily: fonts.display }]}>{moveNames.length}</Text>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Movements</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.line }]}>
            <Text style={[styles.infoK, { color: colors.ink2 }]}>Rotation</Text>
            <Text style={[styles.infoV, { color: colors.ink, fontFamily: fonts.monoBold }]}>
              {sessions.map((s) => s.letter).join("")}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.line }]}>
            <Text style={[styles.infoK, { color: colors.ink2 }]}>
              This block's reps
              {"\n"}
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {block >= 2 ? "Eight reps, heavier than block 1" : "Ten reps, two sets in week 1 then three"}
              </Text>
            </Text>
            <Text style={[styles.infoV, { color: colors.ink, fontFamily: fonts.monoBold }]}>{sessions[0]?.moves[0]?.spec}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.line }]}>
            <Text style={[styles.infoK, { color: colors.ink2 }]}>Equipment</Text>
            <Text style={[styles.infoV, { color: colors.ink, fontFamily: fonts.monoBold }]}>
              {profile.where === "gym" || profile.where === "garage"
                ? "Machines + dumbbells"
                : profile.where === "home_none" || profile.where === "outside"
                ? "Bodyweight"
                : "Dumbbells"}
            </Text>
          </View>
        </Card>

        <TouchableOpacity activeOpacity={0.7} style={[styles.navCard, { backgroundColor: colors.raised }]} onPress={() => navigation.navigate("FirstDay")}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Your first day</Text>
            <Text style={[styles.moveCue, { color: colors.muted }]}>What to wear, what to bring, and walking in for the first time.</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>The {sessionCount} sessions</Text>
          <Text style={[styles.note, { color: colors.muted }]}>
            They rotate {sessions.map((s) => s.letter).join(", ")}. Every movement has a video, a swap if the machine's taken, and an easier version.
          </Text>
          {sessions.map((s, i) => (
            <SessionAccordion key={s.letter} s={s} count={doneLetters[s.letter] || 0} first={i === 0} colors={colors} />
          ))}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Every movement</Text>
          <Text style={[styles.note, { color: colors.muted }]}>Tap any one for what it trains and why it's here.</Text>
          {moveNames.map((n, i) => {
            const last = lastFor(n, history);
            return (
              <TouchableOpacity
                key={n}
                activeOpacity={0.7}
                onPress={() => setOpenMove(n)}
                style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{n}</Text>
                  <Text style={[styles.moveCue, { color: colors.muted }]}>
                    {last ? `Your best: ${last.w} ${u}` : "Not done yet"}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Blocks</Text>
          {Array.from({ length: totalBlocks }).map((_, i) => {
            const b = i + 1;
            let detail: string;
            if (b === 1) {
              const s1 = setsFor(1, 1, profile.length);
              const s2 = setsFor(1, 2, profile.length);
              detail = s1 === s2 ? `Learn the movements. ${s1} sets throughout. Retest at the end.` : `Learn the movements. ${s1} sets, then ${s2}. Retest at the end.`;
            } else if (b === 2) detail = "Same movements, heavier. Eight reps instead of ten.";
            else if (b === 3) detail = "Heavier again, and the first movement swaps. Unlocks when you finish block 2.";
            else detail = "Further out. Each block builds on the one before it.";

            let right: React.ReactNode;
            if (b < block) right = <Text style={{ color: colors.good, fontSize: 12, fontFamily: fonts.bodyBold }}>Done</Text>;
            else if (b === block)
              right = (
                <Text style={{ color: colors.muted, fontSize: 12, fontFamily: fonts.bodyBold }}>
                  Week {wk} of {wpb}
                </Text>
              );
            else if (b <= owned) right = <Text style={{ color: colors.good, fontSize: 12, fontFamily: fonts.bodyBold }}>Unlocked</Text>;
            else
              right = (
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Plans")}>
                  <Text style={{ color: colors.accent, fontSize: 13, fontFamily: fonts.bodyBold }}>${PRICE_ONE}</Text>
                </TouchableOpacity>
              );

            return (
              <View key={b} style={[styles.blockRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View style={[styles.blockNum, { backgroundColor: colors.sunken }]}>
                  <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 16 }}>{b}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.blockTitleRow}>
                    <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Block {b}</Text>
                    {right}
                  </View>
                  <Text style={[styles.moveCue, { color: colors.muted }]}>{detail}</Text>
                </View>
              </View>
            );
          })}
        </Card>

        {bundle ? (
          <TouchableOpacity activeOpacity={0.7} style={[styles.navCard, { backgroundColor: colors.raised, marginTop: spacing.md }]} onPress={() => navigation.navigate("Plans")}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Next three blocks</Text>
                <Text style={{ color: colors.accentDeep, fontFamily: fonts.monoBold }}>${PRICE_THREE}</Text>
              </View>
              <Text style={[styles.moveCue, { color: colors.muted }]}>
                Blocks {bundle.blocks[0]}–{bundle.blocks[2]}, about {wpb * 3} weeks. Cheaper than one at a time, and nothing to remember.
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display, marginTop: spacing.lg }]}>Other first times</Text>
        {appState.categories
          .filter((c) => !c.live)
          .map((o) => {
            const on = !!notify[o.key];
            return (
              <Card key={o.key} style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{o.name.toUpperCase()}</Text>
                  <Text style={[styles.moveCue, { color: colors.muted }]}>{o.sub}. First block free when it lands.</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.notifyBtn, { borderColor: on ? colors.accent : colors.line }, on && { backgroundColor: colors.accentSoft }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    appState.toggleProgramNotify(o.key);
                  }}
                >
                  <Text style={{ color: on ? colors.accentDeep : colors.ink, fontSize: 12, fontFamily: fonts.bodyBold }}>
                    {on ? "On the list" : "Tell me"}
                  </Text>
                </TouchableOpacity>
              </Card>
            );
          })}
      </ScrollView>

      <Sheet visible={!!openMove} onClose={() => setOpenMove(null)}>
        {openM ? (
          <>
            <Text style={[styles.sheetTitle, { color: colors.ink, fontFamily: fonts.display }]}>{openMove}</Text>
            <Text style={[styles.sheetBody, { color: colors.ink2 }]}>
              {openM.why || openM.orig?.why || "Same muscles as the gym version of this movement."}
            </Text>
            <Text style={[styles.sheetLine, { color: colors.ink }]}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Cue: </Text>
              {openM.cue}
            </Text>
            <Text style={[styles.sheetLine, { color: colors.ink }]}>
              <Text style={{ fontFamily: fonts.bodyBold }}>This block: </Text>
              {openM.spec}
            </Text>
            {openM.orig?.sub ? (
              <Text style={[styles.sheetLine, { color: colors.ink }]}>
                <Text style={{ fontFamily: fonts.bodyBold }}>If it's taken: </Text>
                {openM.orig.sub.n}.
              </Text>
            ) : null}
            {openM.orig?.easier ? (
              <Text style={[styles.sheetLine, { color: colors.ink }]}>
                <Text style={{ fontFamily: fonts.bodyBold }}>Easier version: </Text>
                {openM.orig.easier.n}.
              </Text>
            ) : null}
            {openLast ? (
              <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>
                Your best: {openLast.w} {u}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function SessionAccordion({
  s,
  count,
  first,
  colors,
}: {
  s: ReturnType<typeof buildSession>;
  count: number;
  first: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setOpen((o) => !o)}
      style={[styles.sessionAccordion, !first && { borderTopWidth: 1, borderTopColor: colors.line }]}
    >
      <View style={styles.accordionHead}>
        <Text style={[styles.accordionTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
          Session {s.letter} · {s.moves.length} movements{count ? ` · ${count}×` : ""}
        </Text>
        <Text style={{ color: colors.muted }}>{open ? "–" : "+"}</Text>
      </View>
      {open
        ? s.moves.map((m) => (
            <View key={m.n} style={styles.accordionMove}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodyMedium }]}>{m.n}</Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>{m.cue}</Text>
              </View>
              <Text style={[styles.moveSpec, { color: colors.ink2, fontFamily: fonts.monoBold }]}>{m.spec}</Text>
            </View>
          ))
        : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: type.displayPageTitle, letterSpacing: 0.5, marginBottom: spacing.md },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  gymTitle: { fontSize: 24, letterSpacing: 0.5 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  gymSub: { fontSize: 12, marginTop: 2 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  track: { height: 6, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  weekRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  weekLabel: { width: 36, fontSize: 11, fontWeight: "700" },
  weekCells: { flexDirection: "row", gap: 3, flex: 1 },
  weekCell: { width: 8, height: 8, borderRadius: 2 },
  weekRight: { width: 70, fontSize: 11, textAlign: "right" },
  sub: { fontSize: type.displaySub, letterSpacing: 0.5, marginBottom: 4 },
  note: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  tiles: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 8 },
  tile: { flex: 1, alignItems: "center" },
  tileNum: { fontSize: 22 },
  tileLabel: { fontSize: 10, textAlign: "center", marginTop: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1 },
  infoK: { fontSize: 13, flex: 1 },
  infoV: { fontSize: 13 },
  navCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 16, marginTop: spacing.md },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  moveName: { fontSize: 14 },
  moveCue: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  moveSpec: { fontSize: 12 },
  blockRow: { flexDirection: "row", gap: 12, paddingVertical: 12 },
  blockNum: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  blockTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notifyBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  sessionAccordion: { paddingVertical: 12 },
  accordionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accordionTitle: { fontSize: 13 },
  accordionMove: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 4 },
  sheetTitle: { fontSize: 22, letterSpacing: 0.5, marginBottom: 8 },
  sheetBody: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  sheetLine: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
});
