import React from "react";
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/ThemeContext";
import { fonts, radius } from "../../lib/theme";

type Props = {
  index: number;
  label: string;
  isWeight: boolean;
  specRight: string; // for non-weight types, the spec text shown in place of an input
  value: string;
  unit: string;
  done: boolean;
  isNext: boolean;
  holdSeconds: number;
  onChangeValue: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
  onToggleDone: () => void;
};

export default function SetRow({
  index,
  label,
  isWeight,
  specRight,
  value,
  unit,
  done,
  isNext,
  holdSeconds,
  onChangeValue,
  onStep,
  onToggleDone,
}: Props) {
  const { colors } = useTheme();
  const locked = isNext && holdSeconds > 0;

  const btnLabel = done ? "✓" : isNext ? (holdSeconds > 0 ? `${holdSeconds}s` : "Done") : "";

  return (
    <View
      style={[
        styles.row,
        { borderColor: colors.line, backgroundColor: colors.raised },
        isNext && { borderColor: colors.accent },
        done && { backgroundColor: colors.goodSoft, borderColor: colors.goodSoft },
      ]}
    >
      <Text style={[styles.label, { color: done ? colors.good : colors.muted, fontFamily: fonts.bodyBold }]}>
        {label}
      </Text>

      {isWeight ? (
        <View style={styles.stepperRow}>
          <TouchableOpacity
            accessibilityLabel={`${label} lighter`}
            style={[styles.stepBtn, { borderColor: colors.line, backgroundColor: colors.raised }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onStep(-1);
            }}
          >
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>–</Text>
          </TouchableOpacity>
          <TextInput
            value={value}
            onChangeText={onChangeValue}
            keyboardType="decimal-pad"
            placeholder=""
            style={[
              styles.input,
              { color: colors.ink, backgroundColor: colors.sunken, fontFamily: fonts.mono },
            ]}
          />
          <TouchableOpacity
            accessibilityLabel={`${label} heavier`}
            style={[styles.stepBtn, { borderColor: colors.line, backgroundColor: colors.raised }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onStep(1);
            }}
          >
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>+</Text>
          </TouchableOpacity>
          <Text style={[styles.unit, { color: colors.muted, fontFamily: fonts.bodyBold }]}>{unit}</Text>
        </View>
      ) : (
        <Text style={[styles.specText, { color: colors.ink, fontFamily: fonts.monoBold }]}>{specRight}</Text>
      )}

      <TouchableOpacity
        disabled={locked}
        accessibilityLabel={locked ? `${label} — wait ${holdSeconds} seconds` : `${label} done`}
        style={[
          styles.chk,
          { borderColor: colors.line, backgroundColor: colors.raised },
          isNext && !locked && { backgroundColor: colors.accent, borderColor: colors.accent },
          locked && { backgroundColor: colors.sunken },
          done && { backgroundColor: colors.good, borderColor: colors.good },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onToggleDone();
        }}
      >
        <Text
          style={[
            styles.chkText,
            {
              color: done ? "#fff" : isNext ? (locked ? colors.muted : colors.accentInk) : colors.ink,
              fontFamily: locked ? fonts.mono : fonts.bodyBold,
            },
          ]}
        >
          {btnLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingLeft: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: { fontSize: 12, letterSpacing: 0.5, minWidth: 38 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: 64,
    textAlign: "center",
    fontSize: 18,
    paddingVertical: 8,
    borderRadius: 9,
  },
  unit: { fontSize: 12 },
  specText: { flex: 1, fontSize: 13 },
  chk: {
    marginLeft: "auto",
    minWidth: 56,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  chkText: { fontSize: 13 },
});
