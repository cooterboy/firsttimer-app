import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, radius, spacing, type } from "../lib/theme";
import { firstDayGym, unit, weekOf, weeksPerBlock } from "../lib/gymProgram";
import { buildSessionForProfile, lastFor, nextTrainingDay } from "../lib/sessionEngine";
import { useAppState } from "../lib/appState";
import Card from "../components/Card";
import Sheet from "../components/workout/Sheet";
import WorkoutScreen from "./WorkoutScreen";

const PLAN_DAYS = [0, 2, 4]; // Mon / Wed / Fri, 0 = Monday
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function greeting(name: string) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return name ? `${period}, ${name}.` : `${period}.`;
}
function todayDate() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function isSameDay(iso: string, d: Date) {
  const a = new Date(iso);
  return a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate();
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const appState = useAppState();
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const dow = (new Date().getDay() + 6) % 7;

  const done = appState.history.length;
  const trainedToday = appState.history.some((h) => isSameDay(h.date, new Date()));
  const resume = !!appState.active && appState.active.block === appState.block && appState.active.idx === appState.session;
  const built = buildSessionForProfile(appState.block, appState.session, appState.profile);
  const week = weekOf(appState.session);
  const weekFilled = week - 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <Header colors={colors} weekFilled={weekFilled} streak={appState.streak} onAvatarPress={() => setAccountOpen(true)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greet}>
          <Text style={[styles.date, { color: colors.muted, fontFamily: fonts.bodyBold }]}>
            {todayDate().toUpperCase()}
          </Text>
          <Text style={[styles.greetTitle, { color: colors.ink, fontFamily: fonts.display }]}>
            {greeting(appState.profile.name)}
          </Text>
        </View>

        <WeekStrip dow={dow} colors={colors} history={appState.history} />

        {trainedToday && !resume ? (
          <DoneForTodayCard colors={colors} block={appState.block} session={appState.session} profile={appState.profile} />
        ) : (
          <SessionCard colors={colors} built={built} history={appState.history} units={appState.profile.units} resume={resume} />
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={trainedToday && !resume}
          style={[
            styles.startBtn,
            { backgroundColor: colors.accent },
            trainedToday && !resume && { backgroundColor: colors.sunken },
          ]}
          onPress={() => setWorkoutOpen(true)}
        >
          <Text
            style={[
              styles.startBtnText,
              { color: colors.accentInk, fontFamily: fonts.display },
              trainedToday && !resume && { color: colors.muted },
            ]}
          >
            {trainedToday && !resume ? `See you ${nextTrainingDay().name}` : resume ? "Continue" : done === 0 ? "Start session 1" : "Start"}
          </Text>
        </TouchableOpacity>

        {done === 0 ? <BeforeFirstOne colors={colors} /> : null}
        <InfoRows colors={colors} />
      </ScrollView>

      <WorkoutScreen visible={workoutOpen} onClose={() => setWorkoutOpen(false)} />

      <Sheet visible={accountOpen} onClose={() => setAccountOpen(false)}>
        <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display, marginBottom: 8 }]}>
          {appState.profile.name || "Your account"}
        </Text>
        {appState.userEmail ? (
          <Text style={[styles.note, { color: colors.muted, marginBottom: spacing.md }]}>{appState.userEmail}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: colors.bad }]}
          onPress={() => {
            setAccountOpen(false);
            appState.signOut();
          }}
        >
          <Text style={{ color: colors.bad, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Sign out</Text>
        </TouchableOpacity>

        {__DEV__ ? (
          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: colors.line, marginTop: spacing.sm }]}
            onPress={() => {
              setAccountOpen(false);
              appState.resetTestData();
            }}
          >
            <Text style={{ color: colors.ink2, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
              Reset test data (dev only)
            </Text>
          </TouchableOpacity>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function Header({
  colors,
  weekFilled,
  streak,
  onAvatarPress,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  weekFilled: number;
  streak: number;
  onAvatarPress: () => void;
}) {
  const total = weeksPerBlock();
  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.logoWord, { color: colors.ink, fontFamily: fonts.display }]}>
          FIRST <Text style={{ color: colors.accent, fontFamily: fonts.display }}>TIMER</Text>
        </Text>
        <View style={styles.logoBar}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.logoBarSeg, { backgroundColor: i < weekFilled ? colors.accent : colors.line }]} />
          ))}
        </View>
      </View>
      <View style={styles.hdrRight}>
        {streak > 0 ? (
          <View style={[styles.streakBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 }}>{streak} in a row</Text>
          </View>
        ) : null}
        <TouchableOpacity style={[styles.avatar, { backgroundColor: colors.ink }]} onPress={onAvatarPress}>
          <Text style={[styles.avatarText, { color: colors.paper, fontFamily: fonts.display }]}>FT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WeekStrip({
  dow,
  colors,
  history,
}: {
  dow: number;
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
}) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dow);
  const doneDates = history.map((h) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  return (
    <Card style={styles.weekCard}>
      <View style={styles.weekRow}>
        {DAY_LETTERS.map((letter, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const isToday = i === dow;
          const isDone = doneDates.includes(d.getTime());
          const isPlan = !isDone && PLAN_DAYS.includes(i) && i >= dow;
          return (
            <View key={i} style={styles.weekDay}>
              <Text style={[styles.weekLabel, { color: colors.muted, fontFamily: fonts.bodyBold }]}>{letter}</Text>
              <View
                style={[
                  styles.weekCircle,
                  { borderColor: isPlan ? colors.accent : colors.line, borderStyle: isPlan ? "dashed" : "solid" },
                  isDone && { backgroundColor: colors.good, borderColor: colors.good },
                  isToday && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.weekNum,
                    { color: isPlan ? colors.ink : colors.muted, fontFamily: fonts.bodyBold },
                    isDone && { color: "#fff" },
                  ]}
                >
                  {isDone ? "✓" : d.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function DoneForTodayCard({
  colors,
  block,
  session,
  profile,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  block: number;
  session: number;
  profile: ReturnType<typeof useAppState>["profile"];
}) {
  const nt = nextTrainingDay();
  const next = buildSessionForProfile(block, session, profile);
  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.ink }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(95,203,134,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#5FCB86", fontFamily: fonts.bodyBold }]}>Done for today</Text>
          </View>
        </View>
        <Text style={[styles.sessionTitle, { color: colors.paper, fontFamily: fonts.display }]}>That's today.</Text>
        <Text style={[styles.sessionSub, { color: colors.paper }]}>
          One session a day. Muscle is built between sessions, not during them. Next up is {nt.name}.
        </Text>
      </View>
      <View style={styles.moveList}>
        <View style={styles.moveRow}>
          <View style={[styles.thumb, { backgroundColor: colors.good }]}>
            <Text style={{ color: "#fff" }}>✓</Text>
          </View>
          <View style={styles.moveText}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
              {nt.name} · Session {session + 1} · {next.letter}
            </Text>
            <Text style={[styles.moveCue, { color: colors.muted }]}>{next.moves.map((m) => m.n).join(" · ")}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function SessionCard({
  colors,
  built,
  history,
  units,
  resume,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  built: ReturnType<typeof buildSessionForProfile>;
  history: ReturnType<typeof useAppState>["history"];
  units: "imperial" | "metric";
  resume: boolean;
}) {
  const u = unit(units);
  const done = history.length;
  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.ink }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(255,110,44,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#FF8A55", fontFamily: fonts.bodyBold }]}>
              Session {built.letter}
            </Text>
          </View>
          <Text style={[styles.sessionWeek, { color: colors.paper, fontFamily: fonts.bodyBold }]}>
            Week {built.week} · {(built.idx % 3) + 1} of 3
          </Text>
        </View>
        <Text style={[styles.sessionTitle, { color: colors.paper, fontFamily: fonts.display }]}>
          {resume ? "Pick up where you left off." : `Session ${built.idx + 1}.`}
        </Text>
        <Text style={[styles.sessionSub, { color: colors.paper }]}>
          {resume
            ? "Your sets so far are saved. Pick it up from the next movement."
            : done === 0
            ? "Five movements, about 35 minutes. You don't need to know any of them yet — the app shows one at a time, with a video."
            : "Five movements. Your last weights are already filled in."}
        </Text>
      </View>

      <View style={styles.moveList}>
        {built.moves.map((m, i) => {
          const last = lastFor(m.n, history);
          const sub = m.swapped ? m.swapped : last ? `Last time ${last.w} ${u}` : m.cue;
          return (
            <View key={m.n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={[styles.thumb, { backgroundColor: colors.sunken }]}>
                <Text style={{ color: colors.muted }}>▶</Text>
              </View>
              <View style={styles.moveText}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{m.n}</Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>{sub}</Text>
              </View>
              <Text style={[styles.moveSpec, { color: colors.ink2, fontFamily: fonts.monoBold }]}>{m.spec}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function BeforeFirstOne({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Before your first one</Text>
      <Text style={[styles.note, { color: colors.muted }]}>Read this once. It's the part no program covers.</Text>
      {firstDayGym.map((g, i) => {
        const isOpen = open === i;
        return (
          <TouchableOpacity
            key={g.title}
            activeOpacity={0.7}
            onPress={() => setOpen(isOpen ? null : i)}
            style={[styles.accordionRow, { borderTopColor: colors.line }]}
          >
            <View style={styles.accordionHead}>
              <Text style={[styles.accordionTitle, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                {g.title}
              </Text>
              <Text style={{ color: colors.muted }}>{isOpen ? "–" : "+"}</Text>
            </View>
            {isOpen && <Text style={[styles.accordionBody, { color: colors.ink2 }]}>{g.body}</Text>}
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

function InfoRows({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const rows = [
    { title: "About 35 minutes", body: "Five minutes warming up, then five movements with a rest between each set." },
    { title: "One movement at a time", body: "The app shows one screen per movement. You never have to remember what's next." },
    {
      title: "Nothing is mandatory",
      body: "Too hard, machine taken, or it hurts — every movement has a one-tap way out. Finishing beats doing it perfectly.",
    },
  ];
  return (
    <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <View key={r.title} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.muted }}>•</Text>
          </View>
          <View style={styles.moveText}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{r.title}</Text>
            <Text style={[styles.moveCue, { color: colors.muted }]}>{r.body}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logoWord: { fontSize: type.displayWord, letterSpacing: 0.5 },
  logoBar: { flexDirection: "row", gap: 3, marginTop: 5 },
  logoBarSeg: { width: 9, height: 4, borderRadius: 2 },
  hdrRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  streakBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, letterSpacing: 0.5 },
  greet: { marginBottom: spacing.md },
  date: { fontSize: type.eyebrow, letterSpacing: 1 },
  greetTitle: { fontSize: type.displayPageTitle, marginTop: 2, letterSpacing: 0.5 },
  weekCard: { padding: 14, marginBottom: spacing.md },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { alignItems: "center", width: 30 },
  weekLabel: { fontSize: 10, letterSpacing: 0.5 },
  weekCircle: {
    marginTop: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  weekNum: { fontSize: 12 },
  sessionCard: { padding: 0, overflow: "hidden", marginBottom: spacing.md },
  sessionTop: { padding: 18, paddingBottom: 14 },
  sessionRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5 },
  sessionWeek: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", opacity: 0.7, letterSpacing: 0.5 },
  sessionTitle: { fontSize: type.displayCardTitle, letterSpacing: 0.5, marginBottom: 8 },
  sessionSub: { fontSize: 13, lineHeight: 19, opacity: 0.75 },
  moveList: { paddingHorizontal: 18, paddingVertical: 6, paddingBottom: 10 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  thumb: { width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  moveText: { flex: 1 },
  moveName: { fontSize: type.body },
  moveCue: { fontSize: type.bodySmall, marginTop: 1, lineHeight: 16 },
  moveSpec: { fontSize: type.mono },
  startBtn: { padding: 22, borderRadius: 13, alignItems: "center", marginBottom: spacing.md },
  startBtnText: { fontSize: 30, letterSpacing: 1 },
  sub: { fontSize: type.displaySub, letterSpacing: 0.5, marginBottom: 2 },
  note: { fontSize: type.note, marginBottom: 6, lineHeight: 17 },
  accordionRow: { borderTopWidth: 1, paddingVertical: 12 },
  accordionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accordionTitle: { fontSize: type.body },
  accordionBody: { fontSize: type.bodySmall, marginTop: 8, lineHeight: 18 },
  signOutBtn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  infoIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});
