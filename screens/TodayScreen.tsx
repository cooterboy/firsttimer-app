import React, { useEffect, useState } from "react";
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, spacing, type } from "../lib/theme";
import { daysPer, FIRST_DAY, ownedBlocks, PRICE_ONE, Program, unit, weeksPerBlock } from "../lib/gymProgram";
import {
  AWAY_DAYS,
  blockRecap,
  buildSessionForProfile,
  comebackWeight,
  dayKey,
  daysAway,
  isComeback,
  lastFor,
  liftDeltas,
  mobilityDue,
  mobilityToday,
  newWeighIn,
  nextTrainingDay,
  isWarmup,
  openerCopy,
  planDays,
  plateauSignal,
  recoveryCooldownActive,
  recoverySignal,
  tiredSignal,
  trainedYesterday,
  walkMinutesToday,
  walksOn,
  weekKey,
  weekRecap,
  weighedThisWeek,
} from "../lib/sessionEngine";
import { WHY_LABEL, Where } from "../lib/types";
import { mobilityMinutes, MOBILITY } from "../lib/mobilityProgram";
import { walkKindLabel } from "../lib/walkProgram";
import { useAppState } from "../lib/appState";
import { useWorkoutModal } from "../lib/workoutModal";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import { DailyOpenerSplash, WeekRecapSplash } from "../components/TodaySplash";
import RecapCard from "../components/RecapCard";

const PLAN_DAYS = [0, 2, 4]; // Mon / Wed / Fri, 0 = Monday
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

// prototype's SET_NOTE (spec/prototype.html:1016) — non-gym `where` values run the gym
// program's content as a stand-in until the trainer writes their own, and Today says
// so. Empty string for "gym" means no banner.
const SET_NOTE: Record<Where, string> = {
  gym: "",
  garage: "Garage version runs the gym program; swap anything you don't have.",
  home_db: "Home program is a placeholder until the trainer writes it.",
  hotel: "Travel version runs the dumbbell program, a placeholder until the trainer writes it.",
  home_none: "Home program is a placeholder until the trainer writes it.",
  outside: "Outdoor version runs the bodyweight program, a placeholder until the trainer writes it.",
};

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
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const dow = (new Date().getDay() + 6) % 7;

  const done = appState.history.length;
  const gapDays = daysAway(appState.lastDate);
  const trainedToday = appState.history.some((h) => isSameDay(h.date, new Date()));
  const resume = !!appState.active && appState.active.block === appState.block && appState.active.idx === appState.session;
  const built = buildSessionForProfile(appState.program, appState.block, appState.session, appState.profile);
  const isPlanDay = planDays().includes(dow);
  // Once any of the three comeback choices has been made, pendingComebackFactor is
  // set (immediately for two of them, ahead of time for "restart the block") — the
  // card shouldn't show again after that, even though isComeback() itself stays true
  // until an actual session logs and moves lastDate. Mirrors the prototype's
  // `isComeback() && !resume && !state.comeback` gate exactly.
  const comebackActive =
    !resume &&
    workoutModal.pendingComebackFactor == null &&
    isComeback(appState.history, appState.lastDate, appState.settings.paused, appState.profile.recoveryAdjustedAt);
  // Block finished, next block not owned — advanceBlock() no longer fires
  // automatically in this state (see WorkoutScreen.tsx's onDone), so session sits at
  // the block length until the person unlocks the next block or repeats this one.
  const blockLocked = !comebackActive && !resume && appState.session >= appState.program.blockSessions && ownedBlocks(appState.purchases) <= appState.block;
  const mobDayActive =
    !comebackActive &&
    !blockLocked &&
    !isPlanDay &&
    !trainedToday &&
    mobilityDue(appState.mobility, appState.settings.mobility) &&
    !resume &&
    done > 0;
  const backToBackActive = !comebackActive && !mobDayActive && !trainedToday && !resume && trainedYesterday(appState.history) && !isPlanDay;

  // Recovery escalation: reuses the exact tag-threshold recoverySignal() RecoveryScreen
  // already read (see lib/sessionEngine.ts). First time it goes "hot", stamp
  // recoveryAdjustedAt and suggest mobility in place of the plan day's lifting session
  // for RECOVERY_COOLDOWN_DAYS. Once the cooldown passes, if it's no longer hot the
  // adjustment clears itself; if it's still hot, escalate to a doctor/trainer banner
  // instead (recoverySwapActive naturally goes false once cooldownActive does).
  const recovery = recoverySignal(appState.history);
  const cooldownActive = recoveryCooldownActive(appState.profile.recoveryAdjustedAt);
  const recoveryEscalated = !!appState.profile.recoveryAdjustedAt && !cooldownActive && recovery.hot;
  useEffect(() => {
    if (!appState.profile.recoveryAdjustedAt && recovery.hot) {
      appState.updateProfile({ recoveryAdjustedAt: new Date().toISOString() });
    } else if (appState.profile.recoveryAdjustedAt && !cooldownActive && !recovery.hot) {
      appState.updateProfile({ recoveryAdjustedAt: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recovery.hot, appState.profile.recoveryAdjustedAt, cooldownActive]);
  const [recoveryOverride, setRecoveryOverride] = useState(false);
  const recoverySwapActive =
    !comebackActive && !blockLocked && isPlanDay && !trainedToday && !resume && cooldownActive && !recoveryOverride;

  // "Noticed" section — unifies recoverySignal()/plateauSignal() (already computed
  // elsewhere: recovery drives RecoverySwapCard above, plateau drives the in-session
  // banner in MovementView.tsx) with one new lightweight pattern, tiredSignal(), into a
  // single place on Today instead of scattered banners. Deliberately not the
  // prototype's full insights() engine — no sleep/food correlation, no multi-week
  // statistical patterns, just these three existing/cheap signals. RecoverySwapCard
  // itself is untouched (it's load-bearing for the session ladder and the Start
  // button, not just a banner); only the escalation banner moves in here.
  const tired = tiredSignal(appState.history);
  const plateauMove = built.moves.find((m) => m.type === "weight" && plateauSignal(appState.history, m.n).plateaued);
  const [dismissedNoticed, setDismissedNoticed] = useState<Set<string>>(new Set());
  const dismissNoticed = (key: string) => setDismissedNoticed((cur) => new Set(cur).add(key));
  const tiredActive = tired.tired && !dismissedNoticed.has("tired");
  const plateauActive = !!plateauMove && !dismissedNoticed.has(`plateau:${plateauMove.n}`);
  const canEaseToday = !comebackActive && !blockLocked && isPlanDay && !trainedToday && !resume;
  const hasNoticed = recoveryEscalated || tiredActive || plateauActive;

  // The ongoing "this week"/"last week" nudge card (prototype's recapCard() call inside
  // renderTodayInner(), spec/prototype.html:1543) — recomputed every render, unlike the
  // one-time WeekRecapSplash below which is gated by settings.recapSeen.
  const isSundayNudge = dow === 6;
  const isEarlyMondayNudge = dow === 0 && !trainedToday;
  const recapNudgeData =
    isSundayNudge || isEarlyMondayNudge
      ? weekRecap(appState.history, appState.mobility, appState.walks, isSundayNudge ? 0 : 1)
      : null;
  const recapNudgeLabel = isSundayNudge ? "This week" : "Last week";

  // Once per app open: the weekly recap wins if it's eligible, otherwise the daily
  // opener — never both (prototype's `if(!showWeekRecap()) showOpener();`, boot()).
  const [openerVisible, setOpenerVisible] = useState(false);
  const [recapVisible, setRecapVisible] = useState(false);
  const [recapData, setRecapData] = useState<ReturnType<typeof weekRecap> | null>(null);
  useEffect(() => {
    const thisWeek = String(weekKey(new Date()));
    if (appState.settings.recapSeen !== thisWeek) {
      const dow0 = (new Date().getDay() + 6) % 7; // 0 = Monday
      const isSunday = dow0 === 6;
      const isEarlyMonday = dow0 === 0 && !trainedToday;
      if (isSunday || isEarlyMonday) {
        const r = weekRecap(appState.history, appState.mobility, appState.walks, isSunday ? 0 : 1);
        if (r.sessions || r.mobility || r.walks) {
          setRecapData(r);
          setRecapVisible(true);
          appState.updateSettings({ recapSeen: thisWeek });
          return;
        }
      }
      appState.updateSettings({ recapSeen: thisWeek });
    }
    if (appState.settings.quotes !== false && appState.settings.openerSeen !== dayKey()) {
      appState.updateSettings({ openerSeen: dayKey() });
      setOpenerVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opener = openerCopy({
    history: appState.history,
    streak: appState.streak,
    session: appState.session,
    block: appState.block,
    blockSessions: appState.program.blockSessions,
    lastDate: appState.lastDate,
    paused: appState.settings.paused,
    isPlanDay,
    mobility: appState.mobility,
    mobilitySetting: appState.settings.mobility,
    name: appState.profile.name,
    recoveryAdjustedAt: appState.profile.recoveryAdjustedAt,
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <AppHeader />
      {recapData ? (
        <WeekRecapSplash
          visible={recapVisible}
          recap={recapData}
          units={appState.profile.units}
          onStartWeek={() => setRecapVisible(false)}
          onSeeNumbers={() => {
            setRecapVisible(false);
            navigation.navigate("Progress");
          }}
        />
      ) : null}
      <DailyOpenerSplash
        visible={openerVisible}
        name={appState.profile.name}
        copy={opener}
        onClose={() => setOpenerVisible(false)}
      />
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

        {appState.settings.paused ? (
          <View style={[styles.pausedBanner, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Paused.</Text> Your streak and your place in the block are
              safe.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.resumeBtn, { borderColor: colors.line }]}
              onPress={() => appState.updateSettings({ paused: false })}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Resume</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {SET_NOTE[appState.profile.where] ? (
          <View style={[styles.pausedBanner, { backgroundColor: colors.warnSoft }]}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Placeholder.</Text> {SET_NOTE[appState.profile.where]}
            </Text>
          </View>
        ) : null}

        {/* Preemptive paywall nudge (block 1, last two weeks, next block not owned) and
            the "away for less than the comeback threshold" welcome-back banner are
            mutually exclusive, matching the prototype's if/else-if. */}
        {!comebackActive &&
        !blockLocked &&
        appState.block === 1 &&
        built.week >= weeksPerBlock(appState.program.blockSessions) - 2 &&
        ownedBlocks(appState.purchases) < 2 ? (
          <View style={[styles.pausedBanner, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Block 2 is ${PRICE_ONE}.</Text> Unlock it now so nothing
              stops when this one ends.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.resumeBtn, { borderColor: colors.line }]}
              onPress={() => navigation.navigate("Programs", { screen: "Plans" })}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>See blocks</Text>
            </TouchableOpacity>
          </View>
        ) : !comebackActive && gapDays >= 5 && gapDays < AWAY_DAYS && done > 0 ? (
          <View style={[styles.pausedBanner, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Welcome back.</Text> Same session, same numbers. Pick up
              right where you left off.
            </Text>
          </View>
        ) : null}

        {backToBackActive ? (
          <View style={[styles.pausedBanner, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Back-to-back.</Text> You trained yesterday. Fine now and
              then; the plan has a day off between sessions for a reason.
            </Text>
          </View>
        ) : null}

        {hasNoticed ? (
          <NoticedCard
            colors={colors}
            recoveryEscalated={recoveryEscalated}
            onOpenRecovery={() => navigation.navigate("You", { screen: "Recovery" })}
            tiredActive={tiredActive}
            tiredCount={tired.count}
            canEaseToday={canEaseToday}
            onEaseToday={() => {
              dismissNoticed("tired");
              workoutModal.openMobility();
            }}
            onDismissTired={() => dismissNoticed("tired")}
            plateauMove={plateauActive ? plateauMove!.n : null}
            onDismissPlateau={() => plateauMove && dismissNoticed(`plateau:${plateauMove.n}`)}
          />
        ) : null}

        {appState.settings.weighin &&
        (appState.weighins.length || appState.profile.weight) &&
        !weighedThisWeek(appState.weighins) &&
        done > 0 ? (
          <WeeklyWeighInCard colors={colors} units={appState.profile.units} onLog={appState.commitWeighIn} />
        ) : null}

        {recapNudgeData ? (
          <RecapCard recap={recapNudgeData} label={recapNudgeLabel} units={appState.profile.units} />
        ) : null}

        <WeekStrip dow={dow} colors={colors} history={appState.history} mobility={appState.mobility} walks={appState.walks} />

        {comebackActive ? (
          <ComebackCard colors={colors} history={appState.history} lastDate={appState.lastDate} units={appState.profile.units} session={appState.session} why={appState.profile.why} />
        ) : blockLocked ? (
          <BlockLockedCard
            colors={colors}
            history={appState.history}
            block={appState.block}
            blockSessions={appState.program.blockSessions}
            owned={ownedBlocks(appState.purchases)}
            units={appState.profile.units}
            onUnlock={() => navigation.navigate("Programs", { screen: "Plans" })}
            onRepeat={() => appState.restartBlockPosition()}
          />
        ) : recoverySwapActive ? (
          <RecoverySwapCard colors={colors} onOverride={() => setRecoveryOverride(true)} />
        ) : mobDayActive ? (
          <MobilityDayCard colors={colors} nextName={nextTrainingDay().name} />
        ) : trainedToday && !resume ? (
          <DoneForTodayCard
            colors={colors}
            program={appState.program}
            block={appState.block}
            session={appState.session}
            profile={appState.profile}
            history={appState.history}
          />
        ) : (
          <SessionCard
            colors={colors}
            built={built}
            active={appState.active}
            history={appState.history}
            units={appState.profile.units}
            resume={resume}
          />
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!comebackActive && !blockLocked && trainedToday && !resume}
          style={[
            styles.startBtn,
            { backgroundColor: colors.accent },
            !comebackActive && !blockLocked && trainedToday && !resume && { backgroundColor: colors.sunken },
          ]}
          onPress={() => {
            if (comebackActive) workoutModal.open(0.85);
            else if (blockLocked) navigation.navigate("Programs", { screen: "Plans" });
            else if (recoverySwapActive || mobDayActive) workoutModal.openMobility();
            else workoutModal.open();
          }}
        >
          <Text
            style={[
              styles.startBtnText,
              { color: colors.accentInk, fontFamily: fonts.display },
              !comebackActive && !blockLocked && trainedToday && !resume && { color: colors.muted },
            ]}
          >
            {comebackActive
              ? "Ease back in"
              : blockLocked
              ? `Unlock block ${appState.block + 1}`
              : recoverySwapActive || mobDayActive
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

        {comebackActive ? (
          <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.infoRow}
              onPress={() => workoutModal.open(1)}
            >
              <View style={styles.moveText}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                  Pick up at my old weights
                </Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>
                  If you kept training elsewhere, or you just feel ready.
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]}
              onPress={() => {
                Alert.alert(
                  "Start the block over?",
                  "Session 1 again, same movements. Everything you already logged stays in your history and on your charts.",
                  [
                    { text: "Not that", style: "cancel" },
                    {
                      text: "Start from session 1",
                      onPress: () => {
                        appState.restartBlockPosition();
                        workoutModal.setPendingComeback(0.85);
                      },
                    },
                  ]
                );
              }}
            >
              <View style={styles.moveText}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                  Start the block over
                </Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>Back to session 1. Your history stays.</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </Card>
        ) : null}
        {comebackActive ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>No streak to rebuild</Text>
            <Text style={[styles.moveCue, { color: colors.muted, marginTop: 2 }]}>
              There's no penalty here and nothing expired. {done} session{done === 1 ? "" : "s"} logged is still {done}{" "}
              session{done === 1 ? "" : "s"} logged.
            </Text>
          </Card>
        ) : null}

        {comebackActive ? null : mobDayActive ? (
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

        {/* Tips only belong to the normal session flow — not comeback, not a rest/
            mobility day, not the already-done-today state (spec/prototype.html's
            done===0/done<6 blocks are both nested inside that same branch). */}
        {!comebackActive && !mobDayActive && !(trainedToday && !resume) ? (
          done === 0 ? (
            <BeforeFirstOne colors={colors} where={appState.profile.where} />
          ) : done < 6 ? (
            <InfoRows colors={colors} rows={STARTER_TIP_ROWS} />
          ) : null
        ) : null}
        {!comebackActive && !mobDayActive && !(trainedToday && !resume) && done === 0 ? (
          <InfoRows colors={colors} rows={BEFORE_FIRST_ROWS} />
        ) : null}

        {appState.profile.where !== "gym" && done >= daysPer() * 2 ? (
          <GymLocatorNudge colors={colors} onPress={() => navigation.navigate("You", { screen: "FindGym" })} />
        ) : null}
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
                  isMob && { backgroundColor: colors.goodSoft, borderColor: colors.goodSoft },
                  isWalk && { backgroundColor: colors.sunken, borderColor: colors.line },
                  isToday && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.weekNum,
                    { color: isPlan ? colors.ink : colors.muted, fontFamily: fonts.bodyBold },
                    isDone && { color: "#fff" },
                    isMob && { color: colors.good },
                    isWalk && { color: colors.ink2 },
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
  program,
  block,
  session,
  profile,
  history,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  program: Program;
  block: number;
  session: number;
  profile: ReturnType<typeof useAppState>["profile"];
  history: ReturnType<typeof useAppState>["history"];
}) {
  const nt = nextTrainingDay();
  const next = buildSessionForProfile(program, block, session, profile);
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
  active,
  history,
  units,
  resume,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  built: ReturnType<typeof buildSessionForProfile>;
  active: ReturnType<typeof useAppState>["active"];
  history: ReturnType<typeof useAppState>["history"];
  units: "imperial" | "metric";
  resume: boolean;
}) {
  const u = unit(units);
  const done = history.length;
  // Resuming an in-progress session: read the actual live per-move state (done/
  // skipped/partial) from appState.active instead of the fresh-build preview, same as
  // the prototype's `act` (spec/prototype.html:1604-1618) — warmup is excluded since
  // built.moves never includes it either.
  const act = resume && active ? active.moves.filter((m) => !isWarmup(m)) : null;
  const doneCount = act ? act.filter((m) => m.skipped || m.done.length >= m.sets).length : 0;
  const moves = act || built.moves;

  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.ink }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.badgeText, { color: colors.accentDeep, fontFamily: fonts.bodyBold }]}>
              Session {built.letter}
            </Text>
          </View>
          <Text style={[styles.sessionWeek, { color: colors.paper, fontFamily: fonts.bodyBold }]}>
            Week {built.week} · {(built.idx % 3) + 1} of 3
          </Text>
        </View>
        <Text style={[styles.sessionTitle, { color: colors.paper, fontFamily: fonts.display }]}>
          {act ? `${doneCount} of ${act.length} done.` : `Session ${built.idx + 1}.`}
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
        {moves.map((m, i) => {
          const last = lastFor(m.n, history);
          let icon = "▶";
          let iconBg = colors.sunken;
          let iconColor = colors.muted;
          let sub = m.swapped ? m.swapped : last ? `Last time ${last.w} ${u}` : m.cue;
          if ("done" in m) {
            if (m.skipped) {
              icon = "–";
              sub = "Skipped today";
            } else if (m.done.length >= m.sets) {
              icon = "✓";
              iconBg = colors.good;
              iconColor = "#fff";
              sub = `${m.type === "weight" && m.w ? `${m.w} ${u} · ` : ""}${m.done.length} sets done`;
            } else if (m.done.length > 0) {
              icon = String(m.done.length);
              sub = `${m.done.length} of ${m.sets} sets done`;
            }
          }
          return (
            <View key={m.n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={[styles.thumb, { backgroundColor: iconBg }]}>
                <Text style={{ color: iconColor }}>{icon}</Text>
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

function ComebackCard({
  colors,
  history,
  lastDate,
  units,
  session,
  why,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  lastDate: string | null;
  units: "imperial" | "metric";
  session: number;
  why: ReturnType<typeof useAppState>["profile"]["why"];
}) {
  const away = daysAway(lastDate);
  const weeks = Math.floor(away / 7);
  const awayTxt = weeks >= 1 ? `${weeks} week${weeks > 1 ? "s" : ""}` : `${away} days`;
  const deltas = liftDeltas(history);
  const top = Object.keys(deltas)
    .sort((a, b) => deltas[b].last - deltas[a].last)
    .slice(0, 3)
    .map((n) => ({ n, w: deltas[n].last }));
  const u = unit(units);

  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.ink }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#fff", fontFamily: fonts.bodyBold }]}>Welcome back</Text>
          </View>
          <Text style={[styles.sessionWeek, { color: "#fff", fontFamily: fonts.bodyBold }]}>{awayTxt} away</Text>
        </View>
        <Text style={[styles.sessionTitle, { color: "#fff", fontFamily: fonts.display }]}>Still here.</Text>
        <Text style={[styles.sessionSub, { color: "#fff" }]}>
          {away >= 21
            ? "However long it's been, the way back in is one session. Nothing reset while you were gone."
            : "Nothing reset. Your numbers are exactly where you left them."}
          {why ? ` You started ${WHY_LABEL[why].toLowerCase()} — that hasn't changed either.` : ""}
        </Text>
      </View>
      <View style={styles.moveList}>
        {top.length ? (
          top.map((t, i) => (
            <View key={t.n} style={[styles.moveRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={[styles.thumb, { backgroundColor: colors.sunken }]}>
                <Text style={{ color: colors.muted }}>▶</Text>
              </View>
              <View style={styles.moveText}>
                <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>{t.n}</Text>
                <Text style={[styles.moveCue, { color: colors.muted }]}>
                  You were at {t.w} {u}
                </Text>
              </View>
              <Text style={[styles.moveSpec, { color: colors.ink2, fontFamily: fonts.monoBold }]}>
                {comebackWeight(t.w, units)} {u}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.moveRow}>
            <View style={[styles.thumb, { backgroundColor: colors.sunken }]}>
              <Text style={{ color: colors.muted }}>▶</Text>
            </View>
            <View style={styles.moveText}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Session {session + 1}</Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>Right where you left off</Text>
            </View>
          </View>
        )}
      </View>
      {top.length ? (
        <Text style={[styles.note, { color: colors.muted, paddingHorizontal: 18, paddingBottom: 16 }]}>
          The right column is where we'd start you back: about 15% lighter for one session, then straight back up.
          Strength comes back much faster than it built.
        </Text>
      ) : null}
    </Card>
  );
}

// Shown once a block finishes and the next one isn't owned yet (see blockLocked in
// TodayScreen — WorkoutScreen.tsx's onDone no longer auto-advances in this state).
// Reuses RecapCard/blockRecap (lib/sessionEngine.ts) for the same tiles the weekly
// recap uses, scoped to the whole block instead of a week, so the offer is led by an
// earned-moment summary rather than a bare price. "Repeat this block" is always right
// there too — finishing without paying never dead-ends the app.
function BlockLockedCard({
  colors,
  history,
  block,
  blockSessions,
  owned,
  units,
  onUnlock,
  onRepeat,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  history: ReturnType<typeof useAppState>["history"];
  block: number;
  blockSessions: number;
  owned: number;
  units: "imperial" | "metric";
  onUnlock: () => void;
  onRepeat: () => void;
}) {
  const recap = blockRecap(history, block, blockSessions);
  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.ink }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#fff", fontFamily: fonts.bodyBold }]}>Block done</Text>
          </View>
        </View>
        <Text style={[styles.sessionTitle, { color: "#fff", fontFamily: fonts.display }]}>Block {block} done.</Text>
        <Text style={[styles.sessionSub, { color: "#fff" }]}>{blockSessions} sessions. Here's what that built.</Text>
      </View>
      <View style={{ padding: 18 }}>
        <RecapCard recap={recap} label={`Block ${block}`} units={units} />
        <TouchableOpacity activeOpacity={0.85} style={[styles.unlockBtn, { backgroundColor: colors.accent }]} onPress={onUnlock}>
          <Text style={{ color: colors.accentInk, fontFamily: fonts.bodyBold, fontSize: 15 }}>Unlock block {owned + 1}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.infoRow} onPress={onRepeat}>
          <View style={styles.moveText}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Repeat block {block}</Text>
            <Text style={[styles.moveCue, { color: colors.muted }]}>Free, any time. Same movements again from session 1.</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// A scoped version of the prototype's insights() — three existing/cheap signals in one
// card instead of scattered banners, not the full pattern engine. Same tone throughout:
// observational, never diagnostic, always an easy out. The escalation row has no
// dismiss (it's a status, not a suggestion — it clears itself once no longer hot,
// same as before); tired/plateau are one-tap dismissible for the rest of this visit.
function NoticedCard({
  colors,
  recoveryEscalated,
  onOpenRecovery,
  tiredActive,
  tiredCount,
  canEaseToday,
  onEaseToday,
  onDismissTired,
  plateauMove,
  onDismissPlateau,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  recoveryEscalated: boolean;
  onOpenRecovery: () => void;
  tiredActive: boolean;
  tiredCount: number;
  canEaseToday: boolean;
  onEaseToday: () => void;
  onDismissTired: () => void;
  plateauMove: string | null;
  onDismissPlateau: () => void;
}) {
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>NOTICED</Text>

      {recoveryEscalated ? (
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenRecovery} style={styles.noticedRow}>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19, flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold }}>Still sore after a break.</Text> A mobility swap and a few
            easier days hasn't settled it — worth a doctor or your gym's trainer, not another adjustment in here.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>›</Text>
        </TouchableOpacity>
      ) : null}

      {tiredActive ? (
        <View style={[styles.noticedRow, recoveryEscalated && { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>Tired going in, {tiredCount} sessions running.</Text> An
              easier session or an extra rest day is a fine call here.
            </Text>
            <View style={styles.noticedActs}>
              {canEaseToday ? (
                <TouchableOpacity activeOpacity={0.7} onPress={onEaseToday}>
                  <Text style={{ color: colors.accentDeep, fontSize: 12, fontFamily: fonts.bodyBold }}>
                    Take it easier today
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity activeOpacity={0.7} onPress={onDismissTired}>
                <Text style={{ color: colors.muted, fontSize: 12, fontFamily: fonts.bodySemiBold }}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {plateauMove ? (
        <View
          style={[
            styles.noticedRow,
            (recoveryEscalated || tiredActive) && { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>
              <Text style={{ fontFamily: fonts.bodyBold }}>{plateauMove}</Text> has been the same weight for a
              while. Worth a form check next time it comes up.
            </Text>
            <View style={styles.noticedActs}>
              <TouchableOpacity activeOpacity={0.7} onPress={onDismissPlateau}>
                <Text style={{ color: colors.muted, fontSize: 12, fontFamily: fonts.bodySemiBold }}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

// Shown on a plan day in place of the scheduled lifting session while a recovery
// adjustment is in effect (see recoverySwapActive in TodayScreen). Suggests, never
// blocks — "I'd rather train today" drops straight through to the normal session card
// for the rest of this visit.
function RecoverySwapCard({
  colors,
  onOverride,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  onOverride: () => void;
}) {
  const mins = mobilityMinutes();
  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.warn }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#fff", fontFamily: fonts.bodyBold }]}>Recovery</Text>
          </View>
        </View>
        <Text style={[styles.sessionTitle, { color: "#fff", fontFamily: fonts.display }]}>Swap today for mobility.</Text>
        <Text style={[styles.sessionSub, { color: "#fff" }]}>
          A few things you've tagged sore keep showing up. {mins} minutes of mobility today instead — lifting picks
          back up next time out.
        </Text>
      </View>
      <TouchableOpacity activeOpacity={0.7} style={styles.infoRow} onPress={onOverride}>
        <View style={styles.moveText}>
          <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
            I'd rather train today
          </Text>
          <Text style={[styles.moveCue, { color: colors.muted }]}>Your call — this is a suggestion, not a lock.</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
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

function WeeklyWeighInCard({
  colors,
  units,
  onLog,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  units: "imperial" | "metric";
  onLog: (entry: ReturnType<typeof newWeighIn>) => void;
}) {
  const [v, setV] = useState("");
  const u = unit(units);
  const submit = () => {
    const n = Number(v);
    if (!(n > 0)) return;
    Keyboard.dismiss();
    onLog(newWeighIn(n));
    setV("");
  };
  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>Weekly weigh-in</Text>
          <Text style={[styles.moveCue, { color: colors.muted }]}>Once a week, same morning. Only you see it.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={v}
            onChangeText={setV}
            placeholder={u}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.muted}
            style={[styles.weighInput, { color: colors.ink, backgroundColor: colors.sunken }]}
          />
          <TouchableOpacity activeOpacity={0.7} style={[styles.weighBtn, { backgroundColor: colors.ink }]} onPress={submit}>
            <Text style={{ color: colors.paper, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Log</Text>
          </TouchableOpacity>
        </View>
      </View>
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

function BeforeFirstOne({ colors, where }: { colors: ReturnType<typeof useTheme>["colors"]; where: Where }) {
  const [open, setOpen] = useState<number | null>(null);
  const guide = FIRST_DAY[where] || FIRST_DAY.gym;
  const atGym = where === "gym" || where === "garage";
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>Before your first one</Text>
      <Text style={[styles.note, { color: colors.muted }]}>
        {atGym ? "Read this once. It's the part no program covers." : "Read this once, then you won't need it again."}
      </Text>
      {guide.map((g, i) => {
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

// Two separate, non-overlapping tip sets (spec/prototype.html:1628-1631 vs
// 1638-1642) — before, both were collapsed into one component shown unconditionally
// forever. BEFORE_FIRST_ROWS pairs with the first-day guide (done === 0 only);
// STARTER_TIP_ROWS is the "still new to this" set (done 1 through 5). Past session 6,
// neither shows.
const BEFORE_FIRST_ROWS = [
  { title: "About 35 minutes", body: "Five minutes warming up, then five movements with a rest between each set." },
  { title: "One movement at a time", body: "The app shows one screen per movement. You never have to remember what's next." },
  {
    title: "Nothing is mandatory",
    body: "Too hard, machine taken, or it hurts — every movement has a one-tap way out. Finishing beats doing it perfectly.",
  },
];
const STARTER_TIP_ROWS = [
  { title: "The one rule", body: "If every rep felt easy, go up next time. If not, stay." },
  { title: "Rest runs itself", body: "The timer starts after each set. Skip it if you want." },
  { title: "Something hurts?", body: 'Tap "This hurts" on any movement. It swaps or skips.' },
];

// prototype's fgNudge (spec/prototype.html:1644-1646): once someone's two weeks into
// a non-gym program, point them at a real gym without making them go looking for it.
function GymLocatorNudge({ colors, onPress }: { colors: ReturnType<typeof useTheme>["colors"]; onPress: () => void }) {
  return (
    <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
      <TouchableOpacity activeOpacity={0.7} style={styles.infoRow} onPress={onPress}>
        <View style={[styles.infoIcon, { backgroundColor: colors.sunken }]}>
          <Text style={{ color: colors.muted }}>i</Text>
        </View>
        <View style={styles.moveText}>
          <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
            Two weeks in. Curious about a gym?
          </Text>
          <Text style={[styles.moveCue, { color: colors.muted }]}>
            Find one near you, walk in on a day pass, switch the program when you're ready.
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
    </Card>
  );
}

function InfoRows({ colors, rows }: { colors: ReturnType<typeof useTheme>["colors"]; rows: { title: string; body: string }[] }) {
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
  pausedBanner: { padding: 13, borderRadius: 12, marginBottom: spacing.md },
  eyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  noticedRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noticedActs: { flexDirection: "row", gap: 16, marginTop: 8 },
  resumeBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-start" },
  weighInput: { width: 70, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 10, fontSize: 14, textAlign: "center" },
  weighBtn: { borderRadius: 9, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
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
  unlockBtn: { borderRadius: 13, paddingVertical: 15, alignItems: "center" },
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
