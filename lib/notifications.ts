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
