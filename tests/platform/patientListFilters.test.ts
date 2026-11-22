import { describe, expect, it } from 'vitest';
import {
  matchesPatientActivityFilter,
  remainingWeightToTargetKg,
} from '../../src/platform/patientListFilters';
import type { PatientProgressSummary } from '../../src/platform/patientProgressSummary';

function progress(overrides: Partial<PatientProgressSummary> = {}): PatientProgressSummary {
  return {
    lastLogDate: '2026-11-22',
    daysSinceLastLog: 0,
    hasLogWithin30Days: true,
    needsFollowUp: false,
    completion7d: 75,
    completionDays7d: 5,
    currentWeightKg: 70,
    currentWaterMl: null,
    weightChangeKg: null,
    weightTargetProgressPercent: null,
    ...overrides,
  };
}

describe('matchesPatientActivityFilter', () => {
  it('matches today and 7-day boundaries from observed log age', () => {
    expect(matchesPatientActivityFilter(progress({ daysSinceLastLog: 0 }), 'loggedToday')).toBe(true);
    expect(matchesPatientActivityFilter(progress({ daysSinceLastLog: 1 }), 'loggedToday')).toBe(false);
    expect(matchesPatientActivityFilter(progress({ daysSinceLastLog: 6 }), 'logged7d')).toBe(true);
    expect(matchesPatientActivityFilter(progress({ daysSinceLastLog: 7 }), 'logged7d')).toBe(false);
    expect(matchesPatientActivityFilter(progress({ daysSinceLastLog: null }), 'logged7d')).toBe(false);
  });

  it('keeps 30-day, follow-up and no-log filters separate', () => {
    expect(matchesPatientActivityFilter(progress({ hasLogWithin30Days: true }), 'active30')).toBe(true);
    expect(matchesPatientActivityFilter(progress({ needsFollowUp: true }), 'followUp')).toBe(true);
    expect(matchesPatientActivityFilter(progress({ hasLogWithin30Days: false }), 'noLog30')).toBe(true);
    expect(matchesPatientActivityFilter(null, 'followUp')).toBe(false);
    expect(matchesPatientActivityFilter(undefined, 'active30')).toBe(false);
    expect(matchesPatientActivityFilter(undefined, 'all')).toBe(true);
  });
});

describe('remainingWeightToTargetKg', () => {
  it('returns absolute distance for both weight loss and gain targets', () => {
    expect(remainingWeightToTargetKg(70, 65)).toBe(5);
    expect(remainingWeightToTargetKg(60, 70)).toBe(10);
    expect(remainingWeightToTargetKg(68.25, 65)).toBe(3.3);
  });

  it('returns null when a valid recorded current or target weight is unavailable', () => {
    expect(remainingWeightToTargetKg(null, 65)).toBeNull();
    expect(remainingWeightToTargetKg(70, undefined)).toBeNull();
    expect(remainingWeightToTargetKg(0, 65)).toBeNull();
    expect(remainingWeightToTargetKg(70, Number.NaN)).toBeNull();
  });
});
