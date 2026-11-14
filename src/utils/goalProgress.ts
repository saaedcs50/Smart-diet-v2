import type { DayLog, PlanConfig } from '../types';
import { calculateDayScore } from './calculations';
import { getAllStoredDayLogs, getTodayDateString, parseLocalDate } from './storage';

export interface GoalProgressSummary {
  currentWeight: number | null;
  targetWeight: number | null;
  remainingKg: number | null;
  passedTargetKg: number | null;
  weeklyAdherence: number | null;
  loggedDays: number;
}

/**
 * Build the compact progress summary for the Today dashboard.
 * Only real, stored days count toward the seven-day average; missing dates
 * never become zero-score days. Weight uses the latest measurement on or
 * before the selected date, never a future record.
 */
export function calculateGoalProgressSummary(
  plan: PlanConfig,
  currentDate: string,
  logs: Record<string, DayLog> = getAllStoredDayLogs(),
): GoalProgressSummary {
  const targetWeight =
    typeof plan.targetWeight === 'number' &&
    Number.isFinite(plan.targetWeight) &&
    plan.targetWeight > 0
      ? plan.targetWeight
      : null;

  const latestWeightEntry = Object.entries(logs)
    .filter(([date, log]) =>
      date <= currentDate &&
      typeof log?.weight === 'number' &&
      Number.isFinite(log.weight) &&
      log.weight > 0,
    )
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))[0];

  const currentWeight = latestWeightEntry?.[1].weight ?? null;
  const delta = currentWeight !== null && targetWeight !== null
    ? Number((currentWeight - targetWeight).toFixed(1))
    : null;

  const anchor = parseLocalDate(currentDate);
  const weeklyScores: number[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - offset,
    );
    const dateKey = getTodayDateString(date);
    const stored = logs[dateKey];
    if (!stored) continue;
    const score = calculateDayScore(plan, stored);
    if (score.total > 0 || stored.isFreeze) weeklyScores.push(score.total);
  }

  return {
    currentWeight,
    targetWeight,
    remainingKg: delta !== null && delta > 0 ? delta : null,
    passedTargetKg: delta !== null && delta < 0 ? Math.abs(delta) : null,
    weeklyAdherence: weeklyScores.length
      ? Math.round(weeklyScores.reduce((sum, score) => sum + score, 0) / weeklyScores.length)
      : null,
    loggedDays: weeklyScores.length,
  };
}
