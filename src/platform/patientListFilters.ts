import type { PatientProgressSummary } from './patientProgressSummary';

export type PatientActivityFilter =
  | 'all'
  | 'loggedToday'
  | 'logged7d'
  | 'active30'
  | 'followUp'
  | 'noLog30';

type PatientActivityProgress = Pick<
  PatientProgressSummary,
  'daysSinceLastLog' | 'hasLogWithin30Days' | 'needsFollowUp'
> | null | undefined;

/** Evaluates activity filters using only observed logs from the saved summary. */
export function matchesPatientActivityFilter(
  progress: PatientActivityProgress,
  filter: PatientActivityFilter,
): boolean {
  if (filter === 'all') return true;
  if (!progress) return false;

  switch (filter) {
    case 'loggedToday':
      return progress.daysSinceLastLog === 0;
    case 'logged7d':
      return progress.daysSinceLastLog != null &&
        progress.daysSinceLastLog >= 0 &&
        progress.daysSinceLastLog <= 6;
    case 'active30':
      return progress.hasLogWithin30Days === true;
    case 'followUp':
      return progress.needsFollowUp === true;
    case 'noLog30':
      return progress.hasLogWithin30Days === false;
  }
}

/** Absolute mathematical distance from the current weight to the plan target. */
export function remainingWeightToTargetKg(
  currentWeightKg: number | null | undefined,
  targetWeightKg: number | null | undefined,
): number | null {
  if (
    typeof currentWeightKg !== 'number' ||
    !Number.isFinite(currentWeightKg) ||
    currentWeightKg <= 0 ||
    typeof targetWeightKg !== 'number' ||
    !Number.isFinite(targetWeightKg) ||
    targetWeightKg <= 0
  ) return null;

  return Math.round(Math.abs(currentWeightKg - targetWeightKg) * 10) / 10;
}
