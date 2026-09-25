import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { fonts, radius, spacing, type } from "../lib/theme";
import { firstDayGym, sessionOneMovements } from "../lib/gymProgram";
import Card from "../components/Card";

const WEEKS_PER_BLOCK = 8;
const WEEK_FILLED = 0; // week 1 of block 1 — nothing filled yet
const PLAN_DAYS = [0, 2, 4]; // Mon / Wed / Fri, 0 = Monday
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning.";
  if (hour < 18) return "Afternoon.";
  return "Evening.";
}

function todayDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const dow = (new Date().getDay() + 6) % 7; // Mon=0 .. Sun=6

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <Header colors={colors} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greet}>
          <Text style={[styles.date, { color: colors.muted, fontFamily: fonts.bodyBold }]}>
            {todayDate().toUpperCase()}
          </Text>
          <Text style={[styles.greetTitle, { color: colors.ink, fontFamily: fonts.display }]}>
            {greeting()}
          </Text>
        </View>

        <WeekStrip dow={dow} colors={colors} />

        <SessionCard colors={colors} />

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.startBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.startBtnText, { color: colors.accentInk, fontFamily: fonts.display }]}>
            Start session 1
          </Text>
        </TouchableOpacity>

        <BeforeFirstOne colors={colors} />
        <InfoRows colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.logoWord, { color: colors.ink, fontFamily: fonts.display }]}>
          FIRST <Text style={{ color: colors.accent, fontFamily: fonts.display }}>TIMER</Text>
        </Text>
        <View style={styles.logoBar}>
          {Array.from({ length: WEEKS_PER_BLOCK }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.logoBarSeg,
                { backgroundColor: i < WEEK_FILLED ? colors.accent : colors.line },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={[styles.avatar, { backgroundColor: colors.ink }]}>
        <Text style={[styles.avatarText, { color: colors.paper, fontFamily: fonts.display }]}>FT</Text>
      </View>
    </View>
  );
}

function WeekStrip({ dow, colors }: { dow: number; colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <Card style={styles.weekCard}>
      <View style={styles.weekRow}>
        {DAY_LETTERS.map((letter, i) => {
          const isToday = i === dow;
          const isPlan = PLAN_DAYS.includes(i) && i >= dow;
          const dayNum = new Date();
          dayNum.setDate(dayNum.getDate() - dow + i);
          return (
            <View key={i} style={styles.weekDay}>
              <Text style={[styles.weekLabel, { color: colors.muted, fontFamily: fonts.bodyBold }]}>
                {letter}
              </Text>
              <View
                style={[
                  styles.weekCircle,
                  {
                    borderColor: isPlan ? colors.accent : colors.line,
                    borderStyle: isPlan ? "dashed" : "solid",
                  },
                  isToday && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.weekNum,
                    { color: isPlan ? colors.ink : colors.muted, fontFamily: fonts.bodyBold },
                  ]}
                >
                  {dayNum.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function SessionCard({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <Card style={styles.sessionCard}>
      <View style={[styles.sessionTop, { backgroundColor: colors.ink }]}>
        <View style={styles.sessionRowTop}>
          <View style={[styles.badge, { backgroundColor: "rgba(255,110,44,.18)" }]}>
            <Text style={[styles.badgeText, { color: "#FF8A55", fontFamily: fonts.bodyBold }]}>
              Session A
            </Text>
          </View>
          <Text style={[styles.sessionWeek, { color: colors.paper, fontFamily: fonts.bodyBold }]}>
            Week 1 · 1 of 3
          </Text>
        </View>
        <Text style={[styles.sessionTitle, { color: colors.paper, fontFamily: fonts.display }]}>
          Session 1.
        </Text>
        <Text style={[styles.sessionSub, { color: colors.paper }]}>
          Five movements, about 35 minutes. You don't need to know any of them yet — the app shows
          one at a time, with a video.
        </Text>
      </View>

      <View style={styles.moveList}>
        {sessionOneMovements.map((m, i) => (
          <View
            key={m.name}
            style={[
              styles.moveRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
            ]}
          >
            <View style={[styles.thumb, { backgroundColor: colors.sunken }]}>
              <Text style={{ color: colors.muted }}>▶</Text>
            </View>
            <View style={styles.moveText}>
              <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
                {m.name}
              </Text>
              <Text style={[styles.moveCue, { color: colors.muted }]}>{m.cue}</Text>
            </View>
            <Text style={[styles.moveSpec, { color: colors.ink2, fontFamily: fonts.monoBold }]}>
              {m.spec}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function BeforeFirstOne({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <Text style={[styles.sub, { color: colors.ink, fontFamily: fonts.display }]}>
        Before your first one
      </Text>
      <Text style={[styles.note, { color: colors.muted }]}>
        Read this once. It's the part no program covers.
      </Text>
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
            {isOpen && (
              <Text style={[styles.accordionBody, { color: colors.ink2 }]}>{g.body}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

function InfoRows({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  const rows = [
    {
      title: "About 35 minutes",
      body: "Five minutes warming up, then five movements with a rest between each set.",
    },
    {
      title: "One movement at a time",
      body: "The app shows one screen per movement. You never have to remember what's next.",
    },
    {
      title: "Nothing is mandatory",
      body:
        "Too hard, machine taken, or it hurts — every movement has a one-tap way out. Finishing beats doing it perfectly.",
    },
  ];
  return (
    <Card style={{ marginTop: spacing.md, padding: 0, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <View
          key={r.title}
          style={[
            styles.infoRow,
            i > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
          ]}
        >
          <View style={[styles.infoIcon, { backgroundColor: colors.sunken }]}>
            <Text style={{ color: colors.muted }}>•</Text>
          </View>
          <View style={styles.moveText}>
            <Text style={[styles.moveName, { color: colors.ink, fontFamily: fonts.bodySemiBold }]}>
              {r.title}
            </Text>
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
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
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
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  infoIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});
