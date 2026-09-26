import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { HistoryEntry, Units } from "../lib/types";
import { fmtDate, setsSummary, SESSION_TAGS } from "../lib/sessionEngine";
import Sheet from "./workout/Sheet";

export default function SessionDetailSheet({
  entry,
  units,
  onClose,
}: {
  entry: HistoryEntry | null;
  units: Units;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const appState = useAppState();
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(entry?.note || "");
  }, [entry?.id]);

  if (!entry) return null;
  const tags = entry.tags || [];

  return (
    <Sheet visible={!!entry} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>
        Block {entry.block} · Session {entry.idx + 1} · {entry.letter}
      </Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {fmtDate(entry.date)} · Wk {entry.week}
        {entry.minutes ? ` · ${entry.minutes} min` : ""}
      </Text>

      <View style={{ marginTop: spacing.md }}>
        {Object.keys(entry.moves).map((n, i) => {
          const m = entry.moves[n];
          return (
            <View key={n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14, flex: 1 }}>{n}</Text>
              <Text style={{ color: colors.ink2, fontFamily: fonts.mono, fontSize: 13 }}>
                {m.type === "weight" ? setsSummary(m, units) : `${m.sets} sets`}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>RATE THIS SESSION</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              appState.updateHistoryEntry(entry.block, entry.idx, { rating: n });
            }}
          >
            <Text style={{ fontSize: 24, color: n <= (entry.rating || 0) ? colors.accent : colors.line }}>★</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>HOW WAS IT?</Text>
      <View style={styles.pillWrap}>
        {SESSION_TAGS.map((t) => {
          const on = tags.includes(t);
          return (
            <TouchableOpacity
              key={t}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                const next = on ? tags.filter((x) => x !== t) : [...tags, t];
                appState.updateHistoryEntry(entry.block, entry.idx, { tags: next });
              }}
              style={[styles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised }]}
            >
              <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>NOTE</Text>
      <View style={styles.noteRow}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Left knee twinged on lunges…"
          placeholderTextColor={colors.muted}
          style={[styles.noteInput, { color: colors.ink, backgroundColor: colors.sunken }]}
        />
        <TouchableOpacity
          style={[styles.saveBtn, { borderColor: colors.line }]}
          onPress={() => appState.updateHistoryEntry(entry.block, entry.idx, { note: note.trim() })}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 }}>SAVE</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, letterSpacing: 0.5, marginBottom: 4 },
  sub: { fontSize: 13 },
  moveRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  stars: { flexDirection: "row", gap: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  noteRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  noteInput: { flex: 1, padding: 12, borderRadius: 10, fontSize: 14 },
  saveBtn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11 },
});
