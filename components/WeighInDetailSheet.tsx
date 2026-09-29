import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { Units, WeighIn } from "../lib/types";
import { fmtDate } from "../lib/sessionEngine";
import { unit } from "../lib/gymProgram";
import Sheet from "./workout/Sheet";

// Same pattern as SessionDetailSheet's "SETS AND WEIGHTS" editing — commits on every
// keystroke (not onBlur, which raced the sheet's own unmount-on-close, see
// SessionDetailSheet.tsx) and a two-step delete confirm, so a duplicate or mistyped
// weigh-in can actually be fixed instead of sitting there forever.
export default function WeighInDetailSheet({
  entry,
  units,
  onClose,
}: {
  entry: WeighIn | null;
  units: Units;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const appState = useAppState();
  const [val, setVal] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setVal(entry ? String(entry.w) : "");
    setConfirmingDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  if (!entry) return null;
  const u = unit(units);

  const onChangeVal = (t: string) => {
    setVal(t);
    const n = Number(t);
    if (n > 0) appState.updateWeighIn(entry.id, n);
  };

  const onDeleteConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    appState.deleteWeighIn(entry.id);
    setConfirmingDelete(false);
    onClose();
  };

  return (
    <Sheet visible={!!entry} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>{fmtDate(entry.date)}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Change the number if this was logged wrong, or remove it.</Text>

      <View style={styles.row}>
        <TextInput
          value={val}
          onChangeText={onChangeVal}
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken, fontFamily: fonts.mono }]}
        />
        <Text style={{ color: colors.muted, fontSize: 14 }}>{u}</Text>
      </View>

      {!confirmingDelete ? (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.deleteBtn, { borderColor: colors.bad, marginTop: spacing.lg }]}
          onPress={() => setConfirmingDelete(true)}
        >
          <Text style={{ color: colors.bad, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Delete this weigh-in</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.ink2, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>No undo.</Text>
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
  sub: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { width: 96, textAlign: "center", padding: 10, borderRadius: 9, fontSize: 16 },
  deleteBtn: { borderWidth: 1, borderRadius: 12, padding: 13, alignItems: "center" },
});
