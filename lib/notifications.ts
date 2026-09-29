// Local notifications for the "Training reminders" setting — Mon/Wed/Fri at a chosen
// time, matching the app's fixed 3-day plan. No server/push-token infra: these are
// scheduled entirely on-device via expo-notifications, so they keep firing even if the
// app is never reopened, and cost nothing to run.
//
// Deliberately static, not session-specific copy: a scheduled trigger's content is
// fixed at schedule time but the trigger repeats indefinitely, so anything referencing
// "session 5" or specific movement names would go stale the moment the user's actual
// position changes. Keeping the message generic means it's never wrong.
import * as Notifications from "expo-notifications";
import { planDays } from "./sessionEngine";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 1 = Sunday ... 7 = Saturday (expo-notifications' WeeklyTriggerInput convention).
const WEEKDAY_NUMBER: Record<number, number> = { 0: 2, 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 1 };
const REMINDER_ID = (planIdx: number) => `first-timer-training-reminder-${planIdx}`;
const MOBILITY_REMINDER_ID = "first-timer-mobility-reminder";
const RECAP_REMINDER_ID = "first-timer-recap-reminder";
// Mobility day itself isn't tied to a fixed calendar day — mobilityDue() checks
// weekly/biweekly "due" status dynamically, not a specific weekday — so there's no
// single day the prototype (or this app) already treats as "mobility day." Saturday is
// a deliberate simplification for the reminder only: a fixed rest-day slot that
// doesn't collide with the Sunday recap notification.
const MOBILITY_REMINDER_WEEKDAY = 7; // Saturday
const RECAP_REMINDER_WEEKDAY = 1; // Sunday

export async function getNotificationPermissionGranted(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.warn("Could not check notification permission:", e);
    return false;
  }
}

// Returns whether permission ended up granted. Only prompts if not already decided —
// if the user already permanently denied it, this returns false without prompting
// again (iOS won't re-show its own dialog either way; the caller should point them
// at system Settings instead).
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") return true;
    if (existing.status === "denied" && existing.canAskAgain === false) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  } catch (e) {
    console.warn("Could not request notification permission:", e);
    return false;
  }
}

function parseRemindTime(remindTime: string): { hour: number; minute: number } {
  const m = remindTime.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return { hour: 7, minute: 0 };
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === "pm") hour += 12;
  return { hour, minute: parseInt(m[2], 10) };
}

export async function cancelTrainingReminders(): Promise<void> {
  await Promise.all(
    planDays().map((d) => Notifications.cancelScheduledNotificationAsync(REMINDER_ID(d)).catch(() => {}))
  );
}

// Re-schedules all three weekly reminders from scratch — cheap and idempotent, so
// callers never need to worry about whether one was already scheduled.
export async function scheduleTrainingReminders(remindTime: string): Promise<void> {
  await cancelTrainingReminders();
  const { hour, minute } = parseRemindTime(remindTime);
  await Promise.all(
    planDays().map((d) =>
      Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID(d),
        content: {
          title: "Today's a training day.",
          body: "Five movements, about 35 minutes. Open First Timer to pick up where you left off.",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: WEEKDAY_NUMBER[d],
          hour,
          minute,
        },
      })
    )
  );
}

export async function cancelMobilityReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MOBILITY_REMINDER_ID).catch(() => {});
}

export async function scheduleMobilityReminder(remindTime: string): Promise<void> {
  await cancelMobilityReminder();
  const { hour, minute } = parseRemindTime(remindTime);
  await Notifications.scheduleNotificationAsync({
    identifier: MOBILITY_REMINDER_ID,
    content: {
      title: "Mobility day.",
      body: "Ten timed stretches, about 12 minutes. Open First Timer to start.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: MOBILITY_REMINDER_WEEKDAY,
      hour,
      minute,
    },
  });
}

export async function cancelRecapReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(RECAP_REMINDER_ID).catch(() => {});
}

export async function scheduleRecapReminder(remindTime: string): Promise<void> {
  await cancelRecapReminder();
  const { hour, minute } = parseRemindTime(remindTime);
  await Notifications.scheduleNotificationAsync({
    identifier: RECAP_REMINDER_ID,
    content: {
      title: "Last week, in one notification.",
      body: "Sessions, weight moved, what went up. Open First Timer to see it.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: RECAP_REMINDER_WEEKDAY,
      hour,
      minute,
    },
  });
}
