import type { DayLog, PlanConfig } from '../types';
import { summarizePatientDayLog } from './patientDashboardMetrics';

export interface PatientProgressEntry {
  date: string;
  log: DayLog;
}

export interface PatientProgressSummary {
  /** Latest log date that falls within the queried 30-day window. */
  lastLogDate: string | null;
  /** Number of calendar days since last log; null means no log in the last 30 days. */
  daysSinceLastLog: number | null;
  hasLogWithin30Days: boolean;
  needsFollowUp: boolean;
  /** Mean meal, water and checklist completion across comparable recorded days in the last 7 days. */
  completion7d: number | null;
  completionDays7d: number;
  /** Latest explicitly recorded weight in the queried window. */
  currentWeightKg: number | null;
  /** Water intake from the latest logged day in the queried 30-day window. */
  currentWaterMl: number | null;
  /** Current recorded weight minus the plan's starting weight; descriptive, not evaluative. */
  weightChangeKg: number | null;
  /** Clamped 0–100 progress from start weight toward target, when all three exist. */
  weightTargetProgressPercent: number | null;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** True when a timestamp falls within the latest N local calendar days, including today. */
export function isWithinLastCalendarDays(
  timestamp: string | undefined,
  days: number,
  today = new Date(),
): boolean {
  if (!timestamp || !Number.isFinite(days) || days < 1) return false;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return false;
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cutoff.setDate(cutoff.getDate() - (Math.floor(days) - 1));
  const createdKey = localDateKey(date);
  return createdKey >= localDateKey(cutoff) && createdKey <= localDateKey(today);
}

function parseLocalDate(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return date;
}

function calendarDaysBetween(older: Date, newer: Date): number {
  const olderUtc = Date.UTC(older.getFullYear(), older.getMonth(), older.getDate());
  const newerUtc = Date.UTC(newer.getFullYear(), newer.getMonth(), newer.getDate());
  return Math.max(0, Math.round((newerUtc - olderUtc) / 86_400_000));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

export function calculateWeightTargetProgress(
  startWeight: number | null | undefined,
  currentWeight: number | null | undefined,
  targetWeight: number | null | undefined,
): number | null {
  if (
    typeof startWeight !== 'number' || !Number.isFinite(startWeight) || startWeight <= 0 ||
    typeof currentWeight !== 'number' || !Number.isFinite(currentWeight) || currentWeight <= 0 ||
    typeof targetWeight !== 'number' || !Number.isFinite(targetWeight) || targetWeight <= 0 ||
    startWeight === targetWeight
  ) return null;

  const rawProgress = ((currentWeight - startWeight) / (targetWeight - startWeight)) * 100;
  return Math.round(Math.max(0, Math.min(100, rawProgress)) * 10) / 10;
}

/**
 * Builds operational follow-up indicators from the supplied, role-scoped
 * recent day logs. No log in 30 days is represented as missing activity,
 * not fabricated as a zero-compliance score.
 */
export function summarizePatientProgress(
  entries: PatientProgressEntry[],
  plan: PlanConfig | null,
  today: Date = new Date(),
): PatientProgressSummary {
  const todayKey = localDateKey(today);
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffKey = localDateKey(cutoff);

  const ordered = entries
    .filter((entry) => parseLocalDate(entry.date) !== null)
    .filter((entry) => entry.date >= cutoffKey && entry.date <= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = ordered[ordered.length - 1] ?? null;
  const lastDate = latest ? parseLocalDate(latest.date) : null;
  const daysSinceLastLog = lastDate ? calendarDaysBetween(lastDate, today) : null;

  const weekCutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  weekCutoff.setDate(weekCutoff.getDate() - 6);
  const weekCutoffKey = localDateKey(weekCutoff);
  const weekEntries = ordered.filter((entry) => entry.date >= weekCutoffKey);

  const completionParts: number[] = [];
  const comparableDays = new Set<string>();
  for (const entry of weekEntries) {
    const summary = summarizePatientDayLog(entry.log, plan);
    const dayParts: number[] = [];
    if (summary.plannedMeals != null && summary.plannedMeals > 0) {
      dayParts.push(Math.min(100, (summary.recordedMeals / summary.plannedMeals) * 100));
    }
    if (summary.plannedTasks != null && summary.plannedTasks > 0) {
      dayParts.push(Math.min(100, (summary.completedTasks / summary.plannedTasks) * 100));
    }
    const waterGoal = plan?.dailyWaterGoalMl ?? plan?.waterGoalMl;
    if (
      typeof waterGoal === 'number' && Number.isFinite(waterGoal) && waterGoal > 0 &&
      typeof entry.log.water === 'number' && Number.isFinite(entry.log.water) && entry.log.water >= 0
    ) {
      dayParts.push(Math.min(100, (entry.log.water / waterGoal) * 100));
    }
    if (dayParts.length > 0) {
      comparableDays.add(entry.date);
      completionParts.push(...dayParts);
    }
  }

  let currentWeightKg: number | null = null;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const weight = ordered[index].log.weight;
    if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
      currentWeightKg = weight;
      break;
    }
  }
  const startWeight = plan?.startWeight;
  const weightChangeKg =
    currentWeightKg != null &&
    typeof startWeight === 'number' &&
    Number.isFinite(startWeight) &&
    startWeight > 0
      ? Math.round((currentWeightKg - startWeight) * 10) / 10
      : null;

  const weightTargetProgressPercent = calculateWeightTargetProgress(
    plan?.startWeight,
    currentWeightKg,
    plan?.targetWeight,
  );
  const hasLogWithin30Days = ordered.length > 0;
  const latestWater = latest?.log.water;
  const currentWaterMl =
    typeof latestWater === 'number' && Number.isFinite(latestWater) && latestWater >= 0
      ? latestWater
      : null;
  return {
    lastLogDate: latest?.date ?? null,
    daysSinceLastLog,
    hasLogWithin30Days,
    needsFollowUp: !hasLogWithin30Days || (daysSinceLastLog != null && daysSinceLastLog >= 3),
    completion7d: average(completionParts),
    completionDays7d: comparableDays.size,
    currentWeightKg,
    currentWaterMl,
    weightChangeKg,
    weightTargetProgressPercent,
  };
}
