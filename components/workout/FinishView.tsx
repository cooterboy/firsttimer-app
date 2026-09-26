import React, { useState } from "react";
import { Share, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, spacing } from "../../lib/theme";
import { ActiveMove, ActiveWorkout, HistoryEntry, Profile } from "../../lib/types";
import { unit } from "../../lib/gymProgram";
import { FinishCopy, RetestSummary, SESSION_TAGS, fmtDate, movedToday, prevFor, retestSummary } from "../../lib/sessionEngine";
import Card from "../Card";

function Badge({ kind, text }: { kind: "good" | "warn" | "muted"; text: string }) {
  const { colors } = useTheme();
  const bg = kind === "good" ? colors.goodSoft : kind === "warn" ? colors.warnSoft : colors.sunken;
  const fg = kind === "good" ? colors.good : kind === "warn" ? colors.warn : colors.muted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

export default function FinishView({
  wo,
  real,
  fc,
  history,
  profile,
  entry,
  isFirst,
  coachLines,
  nextTitle,
  nextMoves,
  blockDone,
  onSaveEntry,
  onDone,
}: {
  wo: ActiveWorkout;
  real: ActiveMove[];
  fc: FinishCopy;
  history: HistoryEntry[];
  profile: Profile;
  entry: HistoryEntry;
  isFirst: boolean;
  coachLines: string[];
  nextTitle: string;
  nextMoves: string;
  blockDone: boolean;
  onSaveEntry: (patch: Partial<HistoryEntry>) => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const u = unit(profile.units);
  const [note, setNote] = useState(entry.note || "");
  const [noteSaved, setNoteSaved] = useState(!!entry.note);
  const rating = entry.rating || 0;
  const tags = entry.tags || [];

  const totalMoved = movedToday(real);
  const doneMoves = real.filter((m) => !m.skipped).length;
  const retest: RetestSummary | null = blockDone ? retestSummary(history, profile.units) : null;

  const share = () => {
    Share.share({ message: fc.caption }).catch(() => {});
  };

  const starNote = ["", "Rough one. Noted.", "Not great. Noted.", "Fine. Thanks.", "Good session.", "Great session."];

  return (
    <View>
      <View style={styles.head}>
        <View style={[styles.badgeGood]}>
          <Text style={{ color: colors.good, fontSize: 11, fontWeight: "700" }}>Session {wo.idx + 1} logged</Text>
        </View>
        <Text style={[styles.finBig, { color: colors.ink, fontFamily: fonts.display }]}>{fc.big}</Text>
        <Text style={[styles.lede, { color: colors.ink2 }]}>{fc.line}</Text>
      </View>

      {fc.wins.length ? (
        <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>{fc.wins[0]}</Text>
            {fc.wins.length > 1 ? " " + fc.wins.slice(1).join(" ") : ""}
          </Text>
        </View>
      ) : null}

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>TODAY, SET BY SET</Text>
        {real.map((m, i) => {
          const prev = prevFor(m.n, wo.block, wo.idx, history);
          let setsText = "";
          let badge: { kind: "good" | "warn" | "muted"; text: string } | null = null;
          if (m.skipped) {
            setsText = "Skipped";
            badge = { kind: "muted", text: "hurt" };
          } else if (m.type === "weight") {
            const ws = (m.setW || []).filter((_, idx) => m.done.includes(idx)).map((v) => v || "");
            const any = ws.some((v) => v);
            setsText = any ? ws.map((v) => v || "—").join(" · ") + " " + u : `${m.done.length} of ${m.sets} sets · no weight logged`;
            if (prev && prev.w && m.w) {
              const d = Math.round((Number(m.w) - Number(prev.w)) * 10) / 10;
              badge = d > 0 ? { kind: "good", text: `+${d}` } : d < 0 ? { kind: "warn", text: String(d) } : { kind: "muted", text: "same" };
            } else badge = { kind: "muted", text: "first" };
          } else {
            setsText = `${m.done.length} of ${m.sets} sets`;
            badge = prev ? { kind: "muted", text: m.done.length >= m.sets ? "all done" : "partial" } : { kind: "muted", text: "first" };
          }
          const feel = m.feel && m.feel !== "skipped" ? { easy: "felt easy", right: "about right", hard: "felt hard" }[m.feel] : "";
          return (
            <View key={m.n} style={[styles.finRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.finName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{m.n}</Text>
                <Text style={[styles.finSub, { color: colors.muted }]}>
                  {setsText}
                  {feel ? ` · ${feel}` : ""}
                </Text>
                {m.mtags && m.mtags.length ? (
                  <Text style={[styles.finSub, { color: colors.muted }]}>{m.mtags.join(" · ")}</Text>
                ) : null}
                {m.note ? <Text style={[styles.finNote, { color: colors.ink2 }]}>"{m.note}"</Text> : null}
              </View>
              {badge ? <Badge kind={badge.kind} text={badge.text} /> : null}
            </View>
          );
        })}
        <View style={[styles.finTot, { borderTopColor: colors.line }]}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {doneMoves} of {real.length} movements · {entry.minutes} min
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontFamily: fonts.mono }}>
            {totalMoved.toLocaleString()} {u} moved
          </Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>COACH'S READ</Text>
        {coachLines.map((l, i) => (
          <Text key={i} style={[styles.coachLine, { color: colors.ink }]}>
            {l}
          </Text>
        ))}
        <Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>
          Rules from the program, reviewed by a certified trainer.
        </Text>
      </Card>

      {retest && retest.rows.length ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>WHAT YOU BUILT</Text>
          <Text style={[styles.retestBig, { color: colors.ink, fontFamily: fonts.display }]}>
            {retest.weeks} week{retest.weeks === 1 ? "" : "s"}. {retest.sessions} session{retest.sessions === 1 ? "" : "s"}.
          </Text>
          <Text style={[styles.lede, { color: colors.ink2, marginBottom: 14 }]}>
            Since {fmtDate(retest.firstDate)}.{" "}
            {retest.liftsUp
              ? `${retest.liftsUp} of your lifts went up and none of it came from anywhere but you showing up.`
              : "Every one of them logged."}
          </Text>
          <Text style={[styles.compareHead, { color: colors.muted }]}>Week one against now</Text>
          <View style={styles.compareRow}>
            <Text style={[styles.compareColHead, { color: colors.muted, flex: 1.4 }]}>Movement</Text>
            <Text style={[styles.compareColHead, { color: colors.muted, flex: 1, textAlign: "right" }]}>Then</Text>
            <Text style={[styles.compareColHead, { color: colors.muted, flex: 1, textAlign: "right" }]}>Now</Text>
          </View>
          {retest.rows.map((r) => (
            <View key={r.name} style={styles.compareRow}>
              <Text style={[styles.compareCell, { color: colors.ink, flex: 1.4 }]}>{r.name}</Text>
              <Text style={[styles.compareCell, { color: colors.muted, fontFamily: fonts.mono, flex: 1, textAlign: "right" }]}>
                {r.first}
              </Text>
              <Text style={[styles.compareCell, { color: colors.ink, fontFamily: fonts.monoBold, flex: 1, textAlign: "right" }]}>
                {r.last}
                {r.pct > 0 ? <Text style={{ color: colors.good, fontSize: 12 }}> +{r.pct}%</Text> : null}
              </Text>
            </View>
          ))}
          <Text style={[styles.note, { color: colors.muted, marginTop: 10 }]}>
            Your first logged weight against your latest, in {unit(profile.units)}.
          </Text>
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>NEXT UP</Text>
        <Text style={[styles.finName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{nextTitle}</Text>
        <Text style={[styles.finSub, { color: colors.muted }]}>{nextMoves}</Text>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>RATE THIS SESSION</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity activeOpacity={0.7}
              key={n}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSaveEntry({ rating: n });
              }}
            >
              <Text style={{ fontSize: 26, color: n <= rating ? colors.accent : colors.line }}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        {rating ? <Text style={[styles.note, { color: colors.muted, marginTop: 6 }]}>{starNote[rating]}</Text> : null}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>HOW WAS IT?</Text>
        <View style={styles.pillWrap}>
          {SESSION_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <TouchableOpacity activeOpacity={0.7}
                key={t}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  const next = on ? tags.filter((x) => x !== t) : [...tags, t];
                  onSaveEntry({ tags: next });
                }}
                style={[
                  styles.pill,
                  { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised },
                ]}
              >
                <Text style={{ color: on ? colors.paper : colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 12 }]}>A NOTE FOR NEXT TIME (OPTIONAL)</Text>
        <View style={styles.noteRow}>
          <TextInput
            value={note}
            onChangeText={(v) => {
              setNote(v);
              setNoteSaved(false);
            }}
            placeholder="Left knee twinged on lunges…"
            placeholderTextColor={colors.muted}
            style={[styles.noteInput, { color: colors.ink, backgroundColor: colors.sunken }]}
          />
          <TouchableOpacity activeOpacity={0.7}
            style={[styles.inlineBtn, { borderColor: colors.line }]}
            onPress={() => {
              onSaveEntry({ note: note.trim() });
              setNoteSaved(true);
            }}
          >
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 }}>SAVE</Text>
          </TouchableOpacity>
        </View>
        {noteSaved && note ? (
          <View style={[styles.banner, { backgroundColor: colors.warnSoft, marginTop: 10 }]}>
            <Text style={{ color: colors.ink, fontSize: 12 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Your note:</Text> {note}
            </Text>
          </View>
        ) : null}
      </Card>

      <TouchableOpacity activeOpacity={0.7} style={[styles.shareBtn, { backgroundColor: colors.ink }]} onPress={share}>
        <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Share this</Text>
      </TouchableOpacity>
      <Text style={[styles.note, { color: colors.muted, textAlign: "center", marginTop: 10 }]}>
        Missed something? Every session reopens from Progress → History.
      </Text>
      <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.accent }]} onPress={onDone}>
        <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>
          {blockDone ? "See what you built" : "Done for today"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 4 },
  retestBig: { fontSize: 28, letterSpacing: 0.5, marginTop: 2, marginBottom: 4 },
  compareHead: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  compareRow: { flexDirection: "row", alignItems: "center" },
  compareColHead: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", paddingBottom: 6 },
  compareCell: { fontSize: 13, paddingVertical: 6 },
  badgeGood: { alignSelf: "flex-start", backgroundColor: "rgba(95,203,134,.18)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  finBig: { fontSize: 44, letterSpacing: 0.5, lineHeight: 44 },
  lede: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  banner: { padding: 13, borderRadius: 12, marginTop: 14 },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  finRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingVertical: 11 },
  finName: { fontSize: 14 },
  finSub: { fontSize: 12, marginTop: 2 },
  finNote: { fontSize: 12, marginTop: 3, fontStyle: "italic" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  finTot: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  coachLine: { fontSize: 14, lineHeight: 21, marginBottom: 6 },
  note: { fontSize: 12, lineHeight: 17 },
  stars: { flexDirection: "row", gap: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  noteRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  noteInput: { flex: 1, padding: 12, borderRadius: 10, fontSize: 14 },
  inlineBtn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11 },
  shareBtn: { marginTop: 14, borderRadius: 13, padding: 16, alignItems: "center" },
  primary: { marginTop: 10, borderRadius: 13, padding: 16, alignItems: "center" },
});
