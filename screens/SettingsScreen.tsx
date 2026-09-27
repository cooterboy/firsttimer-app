import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { ThemeMode } from "../lib/ThemeContext";
import {
  cancelTrainingReminders,
  getNotificationPermissionGranted,
  requestNotificationPermission,
  scheduleTrainingReminders,
} from "../lib/notifications";

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: colors.sunken }]}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            key={o.v}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.v);
            }}
            style={[styles.segBtn, on && { backgroundColor: colors.raised }]}
          >
            <Text style={{ color: on ? colors.ink : colors.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>{o.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Row({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium }}>{title}</Text>
        {sub ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function hapticToggle<T>(fn: (v: T) => void) {
  return (v: T) => {
    Haptics.selectionAsync().catch(() => {});
    fn(v);
  };
}

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const [remindTime, setRemindTime] = useState(appState.settings.remindTime);
  // Whether the OS actually has notification permission granted right now — the
  // toggle needs to reflect this, not just the stored preference, since the user can
  // revoke it in system Settings at any time without the app knowing.
  const [notifBlocked, setNotifBlocked] = useState(false);
  // Read fresh inside the focus-check below without making its effect re-fire on
  // every settings change — it should only actually check on a real focus event.
  const remindersOnRef = React.useRef(appState.settings.reminders);
  remindersOnRef.current = appState.settings.reminders;

  // Same defensive re-sync as Account (see its comment) — cheap insurance against
  // screen-instance reuse, even though nothing outside this screen currently
  // changes remindTime.
  useFocusEffect(
    React.useCallback(() => {
      setRemindTime(appState.settings.remindTime);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appState.settings.remindTime])
  );

  // Reconciles the stored preference against real OS permission, only on an actual
  // focus event (e.g. returning from system Settings) — not on every settings change.
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const granted = await getNotificationPermissionGranted();
        setNotifBlocked(!granted && remindersOnRef.current);
        if (!granted && remindersOnRef.current) {
          appState.updateSettings({ reminders: false });
          cancelTrainingReminders().catch(() => {});
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const toggleReminders = async (wantsOn: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    if (!wantsOn) {
      appState.updateSettings({ reminders: false });
      cancelTrainingReminders().catch(() => {});
      setNotifBlocked(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      setNotifBlocked(true);
      Alert.alert(
        "Notifications are off",
        "Turn them on for First Timer in your phone's Settings app, then come back and try again.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    setNotifBlocked(false);
    await scheduleTrainingReminders(appState.settings.remindTime).catch(() => {});
    appState.updateSettings({ reminders: true });
  };

  const onRemindTimeBlur = () => {
    appState.updateSettings({ remindTime });
    if (appState.settings.reminders) scheduleTrainingReminders(remindTime).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.group, { borderColor: colors.line }]}>
          <Row
            title="Units"
            right={
              <Seg
                value={appState.profile.units}
                options={[
                  { v: "imperial", l: "lb" },
                  { v: "metric", l: "kg" },
                ]}
                onChange={(v) => appState.setUnits(v)}
              />
            }
          />
          <Row
            title="Appearance"
            right={
              <Seg<ThemeMode>
                value={mode}
                options={[
                  { v: "system", l: "Auto" },
                  { v: "light", l: "Light" },
                  { v: "dark", l: "Dark" },
                ]}
                onChange={setMode}
              />
            }
          />
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>WORKOUT</Text>
        <View style={[styles.group, { borderColor: colors.line }]}>
          <Row
            title="Start rest timer automatically"
            sub="After each set you mark done."
            right={
              <Switch
                value={appState.settings.autoRest}
                onValueChange={hapticToggle((v: boolean) => appState.updateSettings({ autoRest: v }))}
              />
            }
          />
          <Row
            title="Default rest"
            sub="Each movement has its own; this covers the rest."
            right={
              <Seg
                value={String(appState.settings.restDefault)}
                options={[
                  { v: "45", l: "45s" },
                  { v: "60", l: "60s" },
                  { v: "90", l: "90s" },
                ]}
                onChange={(v) => appState.updateSettings({ restDefault: Number(v) })}
              />
            }
          />
          <Row
            title="Warm-up step"
            sub="Five-minute timer before the first movement."
            right={<Switch value={appState.settings.warmup} onValueChange={hapticToggle((v: boolean) => appState.updateSettings({ warmup: v }))} />}
          />
          <Row
            title="Mobility day"
            sub="Ten timed stretches, about 12 minutes, on a non-training day."
            right={
              <Seg
                value={appState.settings.mobility}
                options={[
                  { v: "weekly", l: "Weekly" },
                  { v: "biweekly", l: "Every 2 wks" },
                  { v: "off", l: "Off" },
                ]}
                onChange={(v) => appState.updateSettings({ mobility: v })}
              />
            }
          />
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>CHECK-INS</Text>
        <View style={[styles.group, { borderColor: colors.line }]}>
          <Row
            title="Training reminders"
            sub={
              notifBlocked
                ? "Blocked in your phone's Settings"
                : appState.settings.reminders
                ? `Mon, Wed, Fri at ${appState.settings.remindTime}`
                : "Off"
            }
            right={<Switch value={appState.settings.reminders} onValueChange={toggleReminders} />}
          />
          {appState.settings.reminders ? (
            <View style={[styles.row, { borderBottomColor: colors.line }]}>
              <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodyMedium, flex: 1 }}>Time</Text>
              <TextInput
                value={remindTime}
                onChangeText={setRemindTime}
                onBlur={onRemindTimeBlur}
                placeholder="7:00 am"
                placeholderTextColor={colors.muted}
                style={[styles.timeInput, { color: colors.ink, backgroundColor: colors.sunken }]}
              />
            </View>
          ) : null}
          <Row
            title="Weekly weigh-in prompt"
            sub="Asks once a week on your first training day."
            right={<Switch value={appState.settings.weighin} onValueChange={hapticToggle((v: boolean) => appState.updateSettings({ weighin: v }))} />}
          />
        </View>
        <Text style={[styles.note, { color: colors.muted }]}>
          The weigh-in prompt is saved as a preference for now — the actual weekly check-in screen is a later build
          step.
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
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: spacing.lg, marginBottom: 8 },
  group: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  seg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  timeInput: { flex: 1, padding: 10, borderRadius: 9, fontSize: 14, textAlign: "right" },
  note: { fontSize: 12, lineHeight: 17, marginTop: 10 },
});
