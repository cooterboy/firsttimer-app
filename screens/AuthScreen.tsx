import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing } from "../lib/theme";
import { useAppState } from "../lib/appState";
import { Profile } from "../lib/types";

type Mode = "welcome" | "signup" | "signin" | "checkEmail";

export default function AuthScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const [mode, setMode] = useState<Mode>("welcome");

  // signup fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [units, setUnits] = useState<Profile["units"]>("imperial");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // signin fields
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPw, setSiShowPw] = useState(false);
  const [siError, setSiError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const submitSignUp = async () => {
    setError("");
    if (!name.trim()) return setError("What should we call you?");
    if (!email.includes("@")) return setError("That email doesn't look right.");
    if (password.length < 8) return setError("8 characters or more.");
    setBusy(true);
    const { error: err, needsEmailConfirm } = await appState.signUp(email.trim().toLowerCase(), password, name.trim(), units);
    setBusy(false);
    if (err) return setError(err);
    if (needsEmailConfirm) setMode("checkEmail");
  };

  const submitSignIn = async () => {
    setSiError("");
    setBusy(true);
    const { error: err } = await appState.signIn(siEmail.trim().toLowerCase(), siPassword);
    setBusy(false);
    if (err) setSiError(err);
  };

  const submitReset = async () => {
    if (!siEmail.includes("@")) return setSiError("Enter your email above first.");
    setBusy(true);
    const { error: err } = await appState.resetPassword(siEmail.trim().toLowerCase());
    setBusy(false);
    if (err) setSiError(err);
    else setResetSent(true);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {mode === "welcome" ? (
            <View style={styles.welcomeWrap}>
              <View>
                <Text style={[styles.mark, { color: colors.ink, fontFamily: fonts.display }]}>
                  FIRST{"\n"}
                  <Text style={{ color: colors.accent, fontFamily: fonts.display }}>TIMER</Text>
                </Text>
                <View style={styles.markBar}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <View key={i} style={[styles.markBarSeg, { backgroundColor: i === 0 ? colors.accent : colors.line }]} />
                  ))}
                </View>
                <Text style={[styles.tagline, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                  Everyone starts here.
                </Text>
                <Text style={[styles.tagsub, { color: colors.ink2 }]}>
                  A program written by a trainer, one session at a time, with your numbers logged as you go. The
                  first eight weeks are free.
                </Text>
              </View>
              <View>
                <TouchableOpacity style={[styles.primary, { backgroundColor: colors.accent }]} onPress={() => setMode("signup")}>
                  <Text style={[styles.primaryText, { color: colors.accentInk, fontFamily: fonts.display }]}>
                    Get started
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ghost, { borderColor: colors.line }]} onPress={() => setMode("signin")}>
                  <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
                    I already have an account
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {mode === "signup" ? (
            <View>
              <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>First, you.</Text>
              <Text style={[styles.lede, { color: colors.ink2 }]}>Under a minute, then session 1.</Text>

              <Field label="First name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Sam"
                  autoCapitalize="words"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                />
              </Field>
              <Field label="Email">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                />
              </Field>
              <Field label="Password">
                <View style={styles.pwRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="8 characters or more"
                    secureTextEntry={!showPw}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { flex: 1, color: colors.ink, backgroundColor: colors.sunken }]}
                  />
                  <TouchableOpacity style={[styles.inlineBtn, { borderColor: colors.line }]} onPress={() => setShowPw((s) => !s)}>
                    <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 }}>
                      {showPw ? "HIDE" : "SHOW"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Field>
              <Text style={[styles.note, { color: colors.muted }]}>
                Your progress is saved to your account and there on any phone you sign in on.
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>UNITS</Text>
              <View style={styles.seg}>
                {(["imperial", "metric"] as const).map((u) => {
                  const on = units === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnits(u)}
                      style={[styles.segBtn, { backgroundColor: on ? colors.raised : "transparent" }]}
                    >
                      <Text style={{ color: on ? colors.ink : colors.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>
                        {u === "imperial" ? "lb" : "kg"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {error ? <Text style={[styles.error, { color: colors.bad }]}>{error}</Text> : null}

              <TouchableOpacity
                disabled={busy}
                style={[styles.primary, { backgroundColor: colors.accent, marginTop: spacing.lg, opacity: busy ? 0.6 : 1 }]}
                onPress={submitSignUp}
              >
                {busy ? <ActivityIndicator color={colors.accentInk} /> : (
                  <Text style={[styles.primaryText, { color: colors.accentInk, fontFamily: fonts.display }]}>
                    Create account
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => setMode("welcome")}>
                <Text style={{ color: colors.ink2, fontSize: 13 }}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {mode === "signin" ? (
            <View>
              <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>Sign in.</Text>
              <Text style={[styles.lede, { color: colors.ink2 }]}>Your sessions, weights, and notes, on any phone.</Text>

              <Field label="Email">
                <TextInput
                  value={siEmail}
                  onChangeText={setSiEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, backgroundColor: colors.sunken }]}
                />
              </Field>
              <Field label="Password">
                <View style={styles.pwRow}>
                  <TextInput
                    value={siPassword}
                    onChangeText={setSiPassword}
                    placeholder=""
                    secureTextEntry={!siShowPw}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { flex: 1, color: colors.ink, backgroundColor: colors.sunken }]}
                  />
                  <TouchableOpacity style={[styles.inlineBtn, { borderColor: colors.line }]} onPress={() => setSiShowPw((s) => !s)}>
                    <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 }}>
                      {siShowPw ? "HIDE" : "SHOW"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Field>

              {siError ? <Text style={[styles.error, { color: colors.bad }]}>{siError}</Text> : null}
              {resetSent ? (
                <Text style={[styles.note, { color: colors.good }]}>Check your email for a reset link.</Text>
              ) : null}

              <TouchableOpacity
                disabled={busy}
                style={[styles.primary, { backgroundColor: colors.accent, marginTop: spacing.sm, opacity: busy ? 0.6 : 1 }]}
                onPress={submitSignIn}
              >
                {busy ? <ActivityIndicator color={colors.accentInk} /> : (
                  <Text style={[styles.primaryText, { color: colors.accentInk, fontFamily: fonts.display }]}>Sign in</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={submitReset}>
                <Text style={{ color: colors.ink2, fontSize: 13 }}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => setMode("signup")}>
                <Text style={{ color: colors.ink2, fontSize: 13 }}>New here? Create an account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => setMode("welcome")}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {mode === "checkEmail" ? (
            <View>
              <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.display }]}>Check your email.</Text>
              <Text style={[styles.lede, { color: colors.ink2 }]}>
                We sent a confirmation link to {email}. Tap it, then come back here and sign in.
              </Text>
              <TouchableOpacity
                style={[styles.primary, { backgroundColor: colors.accent, marginTop: spacing.lg }]}
                onPress={() => {
                  setSiEmail(email);
                  setMode("signin");
                }}
              >
                <Text style={[styles.primaryText, { color: colors.accentInk, fontFamily: fonts.display }]}>
                  I've confirmed, sign in
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  welcomeWrap: { flex: 1, justifyContent: "space-between", minHeight: 560 },
  mark: { fontSize: 52, lineHeight: 52, letterSpacing: 0.5 },
  markBar: { flexDirection: "row", gap: 5, marginTop: 14, marginBottom: 26 },
  markBarSeg: { width: 26, height: 6, borderRadius: 3 },
  tagline: { fontSize: 22, lineHeight: 28, marginBottom: 8, maxWidth: 260 },
  tagsub: { fontSize: 14, lineHeight: 20, maxWidth: 320 },
  big: { fontSize: 38, letterSpacing: 0.5, marginBottom: 6 },
  lede: { fontSize: 14, lineHeight: 20, marginBottom: 20, maxWidth: 320 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 7 },
  input: { padding: 13, fontSize: 16, borderRadius: 11 },
  pwRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  inlineBtn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 13 },
  note: { fontSize: 12, lineHeight: 17, marginTop: -6, marginBottom: 14 },
  error: { fontSize: 13, marginBottom: 10 },
  seg: { flexDirection: "row", borderRadius: 10, padding: 3, backgroundColor: "rgba(140,130,110,0.15)", alignSelf: "flex-start", gap: 2 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  primary: { borderRadius: 13, padding: 16, alignItems: "center" },
  primaryText: { fontSize: 24, letterSpacing: 0.5 },
  ghost: { borderWidth: 1, borderRadius: 13, padding: 13, alignItems: "center", marginTop: 8 },
  linkBtn: { alignItems: "center", marginTop: 14 },
});
