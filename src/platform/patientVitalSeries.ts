import type { DayLog } from '../types';

export interface PatientVitalPoint {
  date: string;
  value: number;
}

export interface PatientVitalSeries {
  bodyFatPercent: PatientVitalPoint[];
  bloodGlucoseMgDl: PatientVitalPoint[];
  systolicBloodPressureMmHg: PatientVitalPoint[];
  diastolicBloodPressureMmHg: PatientVitalPoint[];
}

export interface PatientVitalEntry {
  date: string;
  log: Pick<DayLog, 'healthMetrics'>;
}

function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isInteger(year) &&
    year > 0 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Converts saved daily measurements into chronological chart points.
 * Only recorded values are plotted; this function does not interpret readings.
 */
export function buildPatientVitalSeries(
  entries: readonly PatientVitalEntry[],
): PatientVitalSeries {
  const byDate = new Map<string, PatientVitalEntry>();

  for (const entry of entries) {
    if (!entry || typeof entry.date !== 'string' || !isValidDateKey(entry.date)) continue;

    const previous = byDate.get(entry.date);
    const previousMetrics = previous?.log.healthMetrics ?? {};
    const nextMetrics = entry.log?.healthMetrics ?? {};

    // A database row is unique per patient/date. Merging also makes malformed
    // duplicate input deterministic without losing a metric from either row.
    byDate.set(entry.date, {
      date: entry.date,
      log: {
        healthMetrics: {
          ...previousMetrics,
          ...nextMetrics,
        },
      },
    });
  }

  const series: PatientVitalSeries = {
    bodyFatPercent: [],
    bloodGlucoseMgDl: [],
    systolicBloodPressureMmHg: [],
    diastolicBloodPressureMmHg: [],
  };

  const ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of ordered) {
    const metrics = entry.log.healthMetrics;
    if (!metrics) continue;

    if (
      positiveFinite(metrics.bodyFatPercent) &&
      metrics.bodyFatPercent <= 100
    ) {
      series.bodyFatPercent.push({ date: entry.date, value: metrics.bodyFatPercent });
    }

    if (positiveFinite(metrics.bloodGlucoseMgDl)) {
      series.bloodGlucoseMgDl.push({ date: entry.date, value: metrics.bloodGlucoseMgDl });
    }

    if (positiveFinite(metrics.systolicBloodPressureMmHg)) {
      series.systolicBloodPressureMmHg.push({
        date: entry.date,
        value: metrics.systolicBloodPressureMmHg,
      });
    }

    if (positiveFinite(metrics.diastolicBloodPressureMmHg)) {
      series.diastolicBloodPressureMmHg.push({
        date: entry.date,
        value: metrics.diastolicBloodPressureMmHg,
      });
    }
  }

  // Keep profile charts readable on long-running patient records.
  for (const points of Object.values(series)) {
    if (points.length > 30) points.splice(0, points.length - 30);
  }

  return series;
}
