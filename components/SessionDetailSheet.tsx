import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { HistoryEntry, HistoryMove, Units } from "../lib/types";
import { fmtDate, prevFor, SESSION_TAGS, setsSummary } from "../lib/sessionEngine";
import { unit } from "../lib/gymProgram";
import Sheet from "./workout/Sheet";

export default function SessionDetailSheet({
  entry,
  units,
  history,
  onClose,
}: {
  entry: HistoryEntry | null;
  units: Units;
  history: HistoryEntry[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const appState = useAppState();
  const [note, setNote] = useState("");
  const [setEdits, setSetEdits] = useState<Record<string, string[]>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setNote(entry?.note || "");
    setConfirmingDelete(false);
    if (entry) {
      const init: Record<string, string[]> = {};
      Object.keys(entry.moves).forEach((n) => {
        const m = entry.moves[n];
        init[n] = m.type === "weight" ? (m.setW && m.setW.length ? m.setW : [m.w || ""]) : [];
      });
      setSetEdits(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  if (!entry) return null;
  const tags = entry.tags || [];
  const u = unit(units);

  // Recomputes this movement's overall weight from its edited sets — same "max of
  // whatever's filled in" rule the live session uses — and pushes the whole moves
  // object (updateHistoryEntry patches at the HistoryEntry level, not per-movement).
  const commitSetEdit = (n: string) => {
    const setW = setEdits[n] || [];
    const nums = setW.map(Number).filter((v) => v > 0);
    const w = nums.length ? String(Math.max(...nums)) : "";
    const nextMoves = { ...entry.moves, [n]: { ...entry.moves[n], setW, w } };
    appState.updateHistoryEntry(entry.block, entry.idx, { moves: nextMoves });
  };

  const onDeletePress = () => setConfirmingDelete(true);
  const onDeleteConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    appState.deleteHistoryEntry(entry.block, entry.idx);
    setConfirmingDelete(false);
    onClose();
  };

  return (
    <Sheet visible={!!entry} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>
        Block {entry.block} · Session {entry.idx + 1} · {entry.letter}
      </Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {fmtDate(entry.date)} · Wk {entry.week}
        {entry.minutes ? ` · ${entry.minutes} min` : ""}. Change anything here; it updates your history and your
        next session's prefills.
      </Text>

      <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>SETS AND WEIGHTS</Text>
      {Object.keys(entry.moves).map((n, i) => {
        const m: HistoryMove = entry.moves[n];
        const prev = prevFor(n, entry.block, entry.idx, history);
        let delta: { text: string; kind: "good" | "warn" | "muted" } | null = null;
        if (m.type === "weight" && prev && prev.w && m.w) {
          const d = Math.round((Number(m.w) - Number(prev.w)) * 10) / 10;
          delta = d > 0 ? { text: `+${d}`, kind: "good" } : d < 0 ? { text: String(d), kind: "warn" } : { text: "same", kind: "muted" };
        }
        return (
          <View key={n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{n}</Text>
              {m.type === "weight" ? (
                <View style={styles.setEditRow}>
                  {(setEdits[n] || []).map((v, si) => (
                    <TextInput
                      key={si}
                      value={v}
                      onChangeText={(t) =>
                        setSetEdits((prevState) => {
                          const next = [...(prevState[n] || [])];
                          next[si] = t;
                          return { ...prevState, [n]: next };
                        })
                      }
                      onBlur={() => commitSetEdit(n)}
                      keyboardType="decimal-pad"
                      style={[styles.setInput, { color: colors.ink, backgroundColor: colors.sunken }]}
                    />
                  ))}
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{u}</Text>
                </View>
              ) : (
                <Text style={{ color: colors.ink2, fontFamily: fonts.mono, fontSize: 13, marginTop: 2 }}>{m.sets} sets done</Text>
              )}
              {m.feel && m.feel !== "skipped" ? (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {{ easy: "felt easy", right: "about right", hard: "felt hard" }[m.feel] || ""}
                </Text>
              ) : null}
            </View>
            {delta ? (
              <View
                style={[
                  styles.deltaBadge,
                  {
                    backgroundColor:
                      delta.kind === "good" ? colors.goodSoft : delta.kind === "warn" ? colors.badSoft : colors.sunken,
                  },
                ]}
              >
                <Text
                  style={{
                    color: delta.kind === "good" ? colors.good : delta.kind === "warn" ? colors.bad : colors.muted,
                    fontSize: 12,
                    fontFamily: fonts.bodyBold,
                  }}
                >
                  {delta.text}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.lg }]}>RATE THIS SESSION</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity activeOpacity={0.7}
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
            <TouchableOpacity activeOpacity={0.7}
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
        <TouchableOpacity activeOpacity={0.7}
          style={[styles.saveBtn, { borderColor: colors.line }]}
          onPress={() => appState.updateHistoryEntry(entry.block, entry.idx, { note: note.trim() })}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 }}>SAVE</Text>
        </TouchableOpacity>
      </View>

      {!confirmingDelete ? (
        <TouchableOpacity activeOpacity={0.7} style={[styles.deleteBtn, { borderColor: colors.bad }]} onPress={onDeletePress}>
          <Text style={{ color: colors.bad, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Delete this session</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.ink2, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
            Removes it from your history and moves your place in the block back one. No undo.
          </Text>
          <TouchableOpacity activeOpacity={0.7} style={[styles.deleteBtn, { borderColor: colors.bad }]} onPress={onDeleteConfirm}>
            <Text style={{ color: colors.bad, fontFamily: fonts.bodyBold, fontSize: 13 }}>Yes, delete it</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.deleteBtn, { borderColor: colors.line, marginTop: 8 }]}
            onPress={() => setConfirmingDelete(false)}
          >
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Keep it</Text>
          </TouchableOpacity>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, letterSpacing: 0.5, marginBottom: 4 },
  sub: { fontSize: 13, lineHeight: 18 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  moveRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 10 },
  setEditRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  setInput: { width: 56, textAlign: "center", padding: 8, borderRadius: 8, fontSize: 14 },
  deltaBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 2 },
  stars: { flexDirection: "row", gap: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  noteRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  noteInput: { flex: 1, padding: 12, borderRadius: 10, fontSize: 14 },
  saveBtn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11 },
  deleteBtn: { borderWidth: 1, borderRadius: 12, padding: 13, alignItems: "center", marginTop: spacing.lg },
});
