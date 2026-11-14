import type { DayLog } from '../types';
import { hasAnyDayActivity } from './streakReminder';
import { parseLocalDate } from './storage';

export function getFirstActivityDate(
  dayLogs: Record<string, DayLog>,
  todayDate: string,
): string | null {
  return Object.entries(dayLogs)
    .filter(([date, log]) => date <= todayDate && hasAnyDayActivity(log))
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b))[0] ?? null;
}

function isValidStartDate(value: string | undefined, todayDate: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > todayDate) return false;
  return Number.isFinite(parseLocalDate(value).getTime());
}

export interface FirstThreeDaysGuideState {
  visible: boolean;
  startDate: string;
  dayNumber: number;
  weightLogged: boolean;
  notificationsEnabled: boolean;
  mealViewed: boolean;
  completedCount: number;
}

/**
 * Determine the first three onboarding days from real patient activity.
 * Older accounts with activity more than two days ago never see this guide.
 * A new account with no activity starts on the current local date.
 */
export function getFirstThreeDaysGuideState(input: {
  todayDate: string;
  dayLogs: Record<string, DayLog>;
  startedAtDate?: string;
  notificationsEnabled: boolean;
  mealViewed: boolean;
}): FirstThreeDaysGuideState {
  const today = parseLocalDate(input.todayDate);
  const validToday = Number.isFinite(today.getTime());
  const firstActivityDate = getFirstActivityDate(input.dayLogs, input.todayDate);
  const startDate = isValidStartDate(input.startedAtDate, input.todayDate)
    ? input.startedAtDate
    : firstActivityDate ?? input.todayDate;
  const start = parseLocalDate(startDate);

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const dayNumber = validToday && Number.isFinite(start.getTime())
    ? Math.floor((todayUtc - startUtc) / 86_400_000) + 1
    : 0;
  const visible = dayNumber >= 1 && dayNumber <= 3;

  const startWindowUtc = startUtc;
  const endWindowUtc = startUtc + 2 * 86_400_000;
  const weightLogged = Object.entries(input.dayLogs).some(([date, log]) => {
    const parsed = parseLocalDate(date);
    const dayUtc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    return Number.isFinite(dayUtc) &&
      dayUtc >= startWindowUtc &&
      dayUtc <= endWindowUtc &&
      date <= input.todayDate &&
      typeof log.weight === 'number' &&
      Number.isFinite(log.weight) &&
      log.weight > 0;
  });

  const completedCount = Number(weightLogged) +
    Number(input.notificationsEnabled) +
    Number(input.mealViewed);

  return {
    visible,
    startDate,
    dayNumber,
    weightLogged,
    notificationsEnabled: input.notificationsEnabled,
    mealViewed: input.mealViewed,
    completedCount,
  };
}
