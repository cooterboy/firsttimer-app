import React, { useEffect, useState } from "react";
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Haptics from "../lib/haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { unit } from "../lib/gymProgram";
import { historyCsv, historyJson } from "../lib/sessionEngine";
import { saveAndShare } from "../lib/exportFile";
import { clearCachedState } from "../lib/localCache";
import { Goal, GOAL_LABEL } from "../lib/types";
import { supabase } from "../lib/supabase";
import { fetchGyms } from "../lib/sync";
import { GYM_OTHER, GYM_OTHER_LABEL, Gym, gymChoiceFor, gymFieldsFor, listedGyms } from "../lib/gyms";
import Sheet from "../components/workout/Sheet";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", color: colors.muted, marginBottom: 7 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function AccountScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const navigation = useNavigation<any>();
  const u = unit(appState.profile.units);

  const isMetric = appState.profile.units === "metric";

  const [name, setName] = useState(appState.profile.name);
  const [age, setAge] = useState(appState.profile.age ? String(appState.profile.age) : "");
  const [weight, setWeight] = useState(appState.profile.weight ? String(appState.profile.weight) : "");
  const [heightCm, setHeightCm] = useState(appState.profile.heightCm ? String(appState.profile.heightCm) : "");
  const [heightFt, setHeightFt] = useState(
    appState.profile.heightCm ? String(Math.floor(appState.profile.heightCm / 2.54 / 12)) : ""
  );
  const [heightIn, setHeightIn] = useState(
    appState.profile.heightCm ? String(Math.round((appState.profile.heightCm / 2.54) % 12)) : ""
  );
  const [goal, setGoal] = useState<Goal | null>(appState.profile.goal);
  // Which gym gave them their box (migration 019) — set in onboarding; here it can
  // be changed, or set for the first time by accounts that onboarded before the
  // question existed. Once answered it can be changed but not un-answered.
  const [gymChoice, setGymChoice] = useState<string | null>(gymChoiceFor(appState.profile));
  const [allGyms, setAllGyms] = useState<Gym[] | null>(null);
  const [gymsFailed, setGymsFailed] = useState(false);
  const loadGyms = () => {
    setGymsFailed(false);
    fetchGyms().then((g) => (g ? setAllGyms(g) : setGymsFailed(true)));
  };
  useEffect(loadGyms, []);
  // Listed gyms, plus whichever one is already saved even if it's no longer listed
  // (an inactive gym, say), so the current answer always shows as selected.
  const gymOptions = allGyms
    ? [...listedGyms(allGyms, __DEV__), ...allGyms.filter((g) => g.code === gymChoice && !listedGyms(allGyms, __DEV__).includes(g))]
    : null;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // useState's initial value only applies on first mount — React Navigation's
  // native-stack reuses this screen instance if you navigate away and back
  // (e.g. via Settings), so without this, a unit conversion or any other
  // profile change made elsewhere wouldn't show up here until app restart.
  // Re-sync from the source of truth every time this screen regains focus.
  useFocusEffect(
    React.useCallback(() => {
      const p = appState.profile;
      setName(p.name);
      setAge(p.age ? String(p.age) : "");
      setWeight(p.weight ? String(p.weight) : "");
      setHeightCm(p.heightCm ? String(p.heightCm) : "");
      setHeightFt(p.heightCm ? String(Math.floor(p.heightCm / 2.54 / 12)) : "");
      setHeightIn(p.heightCm ? String(Math.round((p.heightCm / 2.54) % 12)) : "");
      setGoal(p.goal);
      setGymChoice(gymChoiceFor(p));
    }, [appState.profile])
  );

  const save = () => {
    Keyboard.dismiss();
    const nextHeightCm = isMetric
      ? Number(heightCm) || null
      : Number(heightFt) || Number(heightIn)
      ? (Number(heightFt) || 0) * 12 * 2.54 + (Number(heightIn) || 0) * 2.54
      : null;
    appState.updateProfile({
      name: name.trim() || appState.profile.name,
      age: Number(age) || null,
      weight: Number(weight) || null,
      heightCm: nextHeightCm,
      goal,
      // Only when it actually changed, so saving other fields doesn't move gym_set_at.
      ...(gymChoice && gymChoice !== gymChoiceFor(appState.profile) ? gymFieldsFor(gymChoice) : {}),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert("Saved");
  };

  const [exportOpen, setExportOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = historyCsv(appState.history, appState.profile.units, appState.mobility, appState.walks, appState.weighins);
      await saveAndShare("first-timer-sessions.csv", csv, "text/csv");
    } catch {
      Alert.alert("Couldn't export", "Something went wrong saving that file.");
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  };
  const exportJson = async () => {
    setExporting(true);
    try {
      const json = historyJson({
        profile: appState.profile,
        settings: appState.settings,
        block: appState.block,
        session: appState.session,
        streak: appState.streak,
        lastDate: appState.lastDate,
        history: appState.history,
        mobility: appState.mobility,
        walks: appState.walks,
        weighins: appState.weighins,
      });
      await saveAndShare("first-timer-data.json", json, "application/json");
    } catch {
      Alert.alert("Couldn't export", "Something went wrong saving that file.");
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  };

  const confirmDelete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if (appState.userId) await clearCachedState(appState.userId);
      await appState.signOut();
    } catch {
      setDeleting(false);
      Alert.alert(
        "Couldn't delete",
        "The delete-account function isn't reachable yet — see supabase/functions/delete-account for deploy instructions."
      );
    }
  };

  const closePwSheet = () => {
    setPwOpen(false);
    setPwOld("");
    setPwNew("");
    setPwErr("");
  };

  const submitPasswordChange = async () => {
    if (pwNew.length < 8) {
      setPwErr("New password needs 8 characters.");
      return;
    }
    setPwErr("");
    setPwBusy(true);
    const { error } = await appState.changePassword(pwOld, pwNew);
    setPwBusy(false);
    if (error) {
      setPwErr(error);
      return;
    }
    closePwSheet();
    Alert.alert("Password changed.");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={styles.topBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.ink, fontFamily: fonts.bodyBold }]}>Account</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Field label="First name">
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
          />
        </Field>
        <Field label="Email">
          <View style={[styles.input, { backgroundColor: colors.sunken, justifyContent: "center" }]}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>{appState.userEmail}</Text>
          </View>
        </Field>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Age">
              <TextInput
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={`Weight (${u})`}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="optional"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
              />
            </Field>
          </View>
        </View>
        {isMetric ? (
          <Field label="Height (cm)">
            <TextInput
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="number-pad"
              placeholder="optional"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
            />
          </Field>
        ) : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Height (ft)">
                <TextInput
                  value={heightFt}
                  onChangeText={setHeightFt}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="(in)">
                <TextInput
                  value={heightIn}
                  onChangeText={setHeightIn}
                  keyboardType="number-pad"
                  placeholder="9"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                />
              </Field>
            </View>
          </View>
        )}
        <Text style={[styles.note, { color: colors.muted }]}>
          Weight and height feed the recovery numbers under Account. Only you see them.
        </Text>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>GOAL</Text>
        <View style={styles.pillWrap}>
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => {
            const on = goal === g;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                key={g}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setGoal(on ? null : g);
                }}
                style={[styles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised }]}
              >
                <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>
                  {GOAL_LABEL[g]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.eyebrow, { color: colors.muted }]}>Which gym gave you your First Timer box?</Text>
        {gymOptions ? (
          <View style={styles.pillWrap}>
            {[...gymOptions.map((g) => ({ code: g.code, label: g.name })), { code: GYM_OTHER, label: GYM_OTHER_LABEL }].map(({ code, label }) => {
              const on = gymChoice === code;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={code}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setGymChoice(code);
                  }}
                  style={[styles.pill, { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.raised }]}
                >
                  <Text style={{ color: on ? colors.paper : colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : gymsFailed ? (
          <View style={styles.pillWrap}>
            <Text style={[styles.note, { color: colors.muted, width: "100%" }]}>Couldn't load the list of gyms.</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={loadGyms}
              style={[styles.pill, { borderColor: colors.line, backgroundColor: colors.raised }]}
            >
              <Text style={{ color: colors.ink, fontSize: 13, fontFamily: fonts.bodySemiBold }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.note, { color: colors.muted }]}>Loading gyms…</Text>
        )}

        <TouchableOpacity activeOpacity={0.7} style={[styles.primary, { backgroundColor: colors.ink, marginTop: spacing.lg }]} onPress={save}>
          <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>Save</Text>
        </TouchableOpacity>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.xl }]}>YOUR DATA</Text>
        <TouchableOpacity activeOpacity={0.7} style={[styles.row, { borderColor: colors.line }]} onPress={() => setExportOpen(true)}>
          <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodySemiBold }}>Download everything</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            Every session and note, as a spreadsheet and a data file. Yours to keep.
          </Text>
        </TouchableOpacity>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.xl }]}>SIGN-IN</Text>
        <TouchableOpacity activeOpacity={0.7} style={[styles.row, { borderColor: colors.line }]} onPress={() => setPwOpen(true)}>
          <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodySemiBold }}>Change password</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          style={[styles.row, { borderColor: colors.line }]}
          onPress={async () => {
            await appState.signOut();
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 14, fontFamily: fonts.bodySemiBold }}>Sign out</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Your data stays synced. Sign back in anytime.</Text>
        </TouchableOpacity>

        <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.xl }]}>DANGER ZONE</Text>
        <View style={[styles.dangerCard, { borderColor: colors.bad }]}>
          <Text style={{ color: colors.ink2, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
            Deleting removes your profile and every logged session. There's no undo.
          </Text>
          {!confirmingDelete ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.ghostDanger, { borderColor: colors.bad }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                setConfirmingDelete(true);
              }}
            >
              <Text style={{ color: colors.bad, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Delete my account and data</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={{ color: colors.bad, fontSize: 12, marginBottom: 10 }}>This wipes everything. There's no undo.</Text>
              <TouchableOpacity activeOpacity={0.7}
                disabled={deleting}
                style={[styles.ghostDanger, { borderColor: colors.bad, opacity: deleting ? 0.6 : 1 }]}
                onPress={confirmDelete}
              >
                <Text style={{ color: colors.bad, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                  {deleting ? "Deleting…" : "Yes, delete it all"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={[styles.ghostDanger, { borderColor: colors.line, marginTop: 8 }]} onPress={() => setConfirmingDelete(false)}>
                <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Keep my account</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Sheet visible={exportOpen} onClose={() => setExportOpen(false)}>
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, marginBottom: 8 }}>
          Download your data
        </Text>
        <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
          Two files. The spreadsheet opens in Excel, Numbers or Sheets. The data file is everything the app holds,
          exactly as it holds it.
        </Text>
        <TouchableOpacity activeOpacity={0.7}
          disabled={exporting}
          style={[styles.exportOpt, { borderColor: colors.accent, backgroundColor: colors.accent, opacity: exporting ? 0.6 : 1 }]}
          onPress={exportCsv}
        >
          <Text style={{ color: colors.accentInk, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
            Sessions as a spreadsheet (.csv)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          disabled={exporting}
          style={[styles.exportOpt, { borderColor: colors.line, opacity: exporting ? 0.6 : 1 }]}
          onPress={exportJson}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Everything (.json)</Text>
        </TouchableOpacity>
      </Sheet>

      <Sheet visible={pwOpen} onClose={closePwSheet}>
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, marginBottom: 8 }}>
          Change password
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 6 }}>
          Current password
        </Text>
        <TextInput
          value={pwOld}
          onChangeText={setPwOld}
          secureTextEntry
          autoComplete="current-password"
          style={[styles.pwInput, { color: colors.ink, backgroundColor: colors.sunken }]}
        />
        <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: 14, marginBottom: 6 }}>
          New password
        </Text>
        <TextInput
          value={pwNew}
          onChangeText={setPwNew}
          secureTextEntry
          placeholder="8 characters or more"
          placeholderTextColor={colors.muted}
          autoComplete="new-password"
          style={[styles.pwInput, { color: colors.ink, backgroundColor: colors.sunken }]}
        />
        {pwErr ? <Text style={{ color: colors.bad, fontSize: 12, marginTop: 10 }}>{pwErr}</Text> : null}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={pwBusy}
          onPress={submitPasswordChange}
          style={[styles.primary, { backgroundColor: colors.ink, marginTop: 16, opacity: pwBusy ? 0.6 : 1 }]}
        >
          <Text style={{ color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 15 }}>{pwBusy ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  input: { padding: 13, fontSize: 16, borderRadius: 11 },
  note: { fontSize: 12, lineHeight: 17, marginTop: -6, marginBottom: 16 },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  primary: { borderRadius: 13, padding: 16, alignItems: "center" },
  row: { borderWidth: 1, borderRadius: 13, padding: 14 },
  dangerCard: { borderWidth: 1, borderRadius: 13, padding: 14 },
  ghostDanger: { borderWidth: 1, borderRadius: 13, padding: 13, alignItems: "center" },
  exportOpt: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center", marginBottom: 10 },
  pwInput: { borderRadius: 10, padding: 12, fontSize: 14 },
});
