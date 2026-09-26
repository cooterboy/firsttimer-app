import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTheme } from "../lib/ThemeContext";
import { fonts, radius, spacing, type } from "../lib/theme";
import { firstDayGym, unit } from "../lib/gymProgram";
import {
  buildSessionForProfile,
  lastFor,
  mobilityDue,
  mobilityToday,
  nextTrainingDay,
  planDays,
  walkMinutesToday,
  walksOn,
} from "../lib/sessionEngine";
import { mobilityMinutes, MOBILITY } from "../lib/mobilityProgram";
import { walkKindLabel } from "../lib/walkProgram";
import { useAppState } from "../lib/appState";
import { useWorkoutModal } from "../lib/workoutModal";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";

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
  const workoutModal = useWorkoutModal();
  const tabBarHeight = useBottomTabBarHeight();
  const dow = (new Date().getDay() + 6) % 7;

  const done = appState.history.length;
  const trainedToday = appState.history.some((h) => isSameDay(h.date, new Date()));
  const resume = !!appState.active && appState.active.block === appState.block && appState.active.idx === appState.session;
  const built = buildSessionForProfile(appState.block, appState.session, appState.profile);
  const isPlanDay = planDays().includes(dow);
  const mobDayActive =
    !isPlanDay && !trainedToday && mobilityDue(appState.mobility, appState.settings.mobility) && !resume && done > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greet}>
          <Text style={[styles.date, { color: colors.muted, fontFamily: fonts.bodyBold }]}>
            {todayDate().toUpperCase()}
          </Text>
          <Text style={[styles.greetTitle, { color: colors.ink, fontFamily: fonts.display }]}>
            {greeting(appState.profile.name)}
          </Text>
        </View>

        {appState.syncError ? (
          <View style={[styles.syncBanner, { backgroundColor: colors.warnSoft }]}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Couldn't reach your saved data.</Text> Showing what's on this
              phone — check your connection and reopen the app to sync the rest.
            </Text>
          </View>
        ) : null}

        <WeekStrip dow={dow} colors={colors} history={appState.history} mobility={appState.mobility} walks={appState.walks} />

        {mobDayActive ? (
          <MobilityDayCard colors={colors} nextName={nextTrainingDay().name} />
        ) : trainedToday && !resume ? (
          <DoneForTodayCard
            colors={colors}
            block={appState.block}
            session={appState.session}
            profile={appState.profile}
            history={appState.history}
          />
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
          onPress={mobDayActive ? workoutModal.openMobility : workoutModal.open}
        >
          <Text
            style={[
              styles.startBtnText,
              { color: colors.accentInk, fontFamily: fonts.display },
              trainedToday && !resume && { color: colors.muted },
            ]}
          >
            {mobDayActive
              ? "Start mobility"
              : trainedToday && !resume
              ? `See you ${nextTrainingDay().name}`
              : resume
              ? "Continue"
              : done === 0
              ? "Start session 1"
              : "Start"}
          </Text>
        </TouchableOpacity>

        {mobDayActive ? (
          <>
            <WalkCard colors={colors} walks={appState.walks} onPress={workoutModal.openWalk} />
            <Card style={{ marginTop: spacing.md }}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                Session {appState.session + 1} is {nextTrainingDay().name}
              </Text>
              <Text style={[styles.moveCue, { color: colors.muted, marginTop: 2 }]}>
                {built.moves.map((m) => m.n).join(" · ")}
              </Text>
            </Card>
            <Card style={{ marginTop: spacing.md }}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Why a rest day</Text>
              <Text style={[styles.moveCue, { color: colors.muted, marginTop: 2 }]}>
                Muscle is built between sessions, not during them. Mobility keeps you moving without adding load.
              </Text>
            </Card>
          </>
        ) : (
          <>
            {mobilityToday(appState.mobility) ? (
              <MobilityDoneBanner colors={colors} minutes={appState.mobility[appState.mobility.length - 1].minutes} />
            ) : mobilityDue(appState.mobility, appState.settings.mobility) && done > 0 ? (
              <TouchableOpacity activeOpacity={0.7} style={[styles.ghostBtn, { borderColor: colors.line }]} onPress={workoutModal.openMobility}>
                <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
                  {trainedToday
                    ? `Loosen up: ${mobilityMinutes()} minutes of mobility`
                    : `Or do ${mobilityMinutes()} minutes of mobility instead`}
                </Text>
              </TouchableOpacity>
            ) : null}
            <WalkCard colors={colors} walks={appState.walks} onPress={workoutModal.openWalk} />
          </>
        )}

        {done === 0 ? <BeforeFirstOne colors={colors} /> : null}
        <InfoRows colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}


function WeekStrip({
  dow,
  colors,
  history,
  mobility,
  walks,
}: {
  dow: number;
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  mobility: ReturnType<typeof useAppState>["mobility"];
  walks: ReturnType<typeof useAppState>["walks"];
}) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dow);
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const doneDates = history.map((h) => dayOf(h.date));
  const mobDates = mobility.map((m) => dayOf(m.date));
  const walkDates = walks.map((w) => dayOf(w.date));

  return (
    <Card style={styles.weekCard}>
      <View style={styles.weekRow}>
        {DAY_LETTERS.map((letter, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const t = d.getTime();
          const isToday = i === dow;
          const isDone = doneDates.includes(t);
          const isMob = !isDone && mobDates.includes(t);
          const isWalk = !isDone && !isMob && walkDates.includes(t);
          const isPlan = !isDone && !isMob && !isWalk && PLAN_DAYS.includes(i) && i >= dow;
          return (
            <View key={i} style={styles.weekDay}>
              <Text style={[styles.weekLabel, { color: colors.muted, fontFamily: fonts.bodyBold }]}>{letter}</Text>
              <View
                style={[
                  styles.weekCircle,
                  { borderColor: isPlan ? colors.accent : colors.line, borderStyle: isPlan ? "dashed" : "solid" },
                  isDone && { backgroundColor: colors.good, borderColor: colors.good },
                  isMob && { backgroundColor: colors.accent, borderColor: colors.accent },
                  isWalk && { backgroundColor: colors.sunken, borderColor: colors.muted },
                  isToday && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.weekNum,
                    { color: isPlan ? colors.ink : colors.muted, fontFamily: fonts.bodyBold },
                    isDone && { color: "#fff" },
                    isMob && { color: colors.accentInk },
                    isWalk && { color: colors.ink },
                  ]}
                >
                  {isDone ? "✓" : isMob ? "M" : isWalk ? "W" : d.getDate()}
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
  history,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  block: number;
  session: number;
  profile: ReturnType<typeof useAppState>["profile"];
  history: ReturnType<typeof useAppState>["history"];
}) {
  const nt = nextTrainingDay();
  const next = buildSessionForProfile(block, session, profile);
  const last = history[history.length - 1];
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
        {last ? (
          <View style={styles.moveRow}>
            <View style={[styles.thumb, { backgroundColor: colors.good }]}>
              <Text style={{ color: "#fff" }}>✓</Text>
            </View>
            <View style={styles.moveText}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                Session {last.idx + 1} logged
              </Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>
                {Object.keys(last.moves).length} movements{last.minutes ? ` · ${last.minutes} min` : ""}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={[styles.moveRow, last && { borderTopWidth: 1, borderTopColor: colors.line }]}>
          <View style={[styles.thumb, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.muted }}>▶</Text>
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

function MobilityDayCard({
  colors,
  nextName,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  nextName: string;
}) {
  const mins = mobilityMinutes();
  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.good }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#fff", fontFamily: fonts.bodyBold }]}>Rest day</Text>
          </View>
          <Text style={[styles.sessionWeek, { color: "#fff", fontFamily: fonts.bodyBold }]}>Next session {nextName}</Text>
        </View>
        <Text style={[styles.sessionTitle, { color: "#fff", fontFamily: fonts.display }]}>Mobility day.</Text>
        <Text style={[styles.sessionSub, { color: "#fff" }]}>
          {mins} minutes on the floor. Ten stretches, timed, one after another. This is what makes {nextName} feel better.
        </Text>
      </View>
      <View style={styles.moveList}>
        {MOBILITY.map((m, i) => (
          <View key={m.n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <View style={[styles.thumb, { backgroundColor: colors.sunken }]}>
              <Text style={{ color: colors.muted }}>▶</Text>
            </View>
            <View style={styles.moveText}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{m.n}</Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>{m.cue}</Text>
            </View>
            <Text style={[styles.moveSpec, { color: colors.ink2, fontFamily: fonts.monoBold }]}>
              {m.sec}s{m.perSide ? " /side" : ""}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function WalkCard({
  colors,
  walks,
  onPress,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  walks: ReturnType<typeof useAppState>["walks"];
  onPress: () => void;
}) {
  const today = walksOn(walks, new Date());
  const mins = walkMinutesToday(walks);
  if (today.length) {
    return (
      <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
        <View style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.good }]}>
            <Text style={{ color: "#fff" }}>✓</Text>
          </View>
          <View style={styles.moveText}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
              {mins} minute{mins === 1 ? "" : "s"} today
            </Text>
            <Text style={[styles.moveCue, { color: colors.muted }]}>
              {today.map((w) => walkKindLabel(w.kind)).join(", ")}
            </Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={0.7} style={styles.infoRow} onPress={onPress}>
          <View style={[styles.infoIcon, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.muted }}>▶</Text>
          </View>
          <View style={styles.moveText}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Log another</Text>
            <Text style={[styles.moveCue, { color: colors.muted }]}>Any day, training or not.</Text>
          </View>
        </TouchableOpacity>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
      <TouchableOpacity activeOpacity={0.7} style={styles.infoRow} onPress={onPress}>
        <View style={[styles.infoIcon, { backgroundColor: colors.sunken }]}>
          <Text style={{ color: colors.muted }}>▶</Text>
        </View>
        <View style={styles.moveText}>
          <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Walk or run</Text>
          <Text style={[styles.moveCue, { color: colors.muted }]}>
            Twenty easy minutes. Logged on its own, never touches your session streak.
          </Text>
        </View>
      </TouchableOpacity>
    </Card>
  );
}

function MobilityDoneBanner({ colors, minutes }: { colors: ReturnType<typeof useTheme>["colors"]; minutes: number }) {
  return (
    <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
      <View style={styles.infoRow}>
        <View style={[styles.infoIcon, { backgroundColor: colors.good }]}>
          <Text style={{ color: "#fff" }}>✓</Text>
        </View>
        <View style={styles.moveText}>
          <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Mobility done today</Text>
          <Text style={[styles.moveCue, { color: colors.muted }]}>{minutes} minutes. Nice.</Text>
        </View>
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
  greet: { marginBottom: spacing.md },
  syncBanner: { padding: 13, borderRadius: 12, marginBottom: spacing.md },
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
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  infoIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  ghostBtn: { borderWidth: 1, borderRadius: 13, padding: 14, alignItems: "center", marginTop: spacing.md },
});
