import { describe, expect, it } from 'vitest';
import type { PatientProgressSummary } from '../../src/platform/patientProgressSummary';
import {
  buildPatientFollowUpQueue,
  type PatientFollowUpCandidate,
} from '../../src/platform/patientFollowUpQueue';

function summary(overrides: Partial<PatientProgressSummary> = {}): PatientProgressSummary {
  return {
    lastLogDate: '2026-11-20',
    daysSinceLastLog: 3,
    hasLogWithin30Days: true,
    needsFollowUp: true,
    completion7d: 70,
    completionDays7d: 2,
    currentWeightKg: null,
    currentWaterMl: null,
    weightChangeKg: null,
    weightTargetProgressPercent: null,
    ...overrides,
  };
}

function candidate(
  uid: string,
  daysSinceLastLog: number | null,
  completion7d: number | null = 70,
): PatientFollowUpCandidate {
  return {
    uid,
    name: uid,
    progress: summary({
      daysSinceLastLog,
      lastLogDate: daysSinceLastLog == null ? null : '2026-11-20',
      hasLogWithin30Days: daysSinceLastLog != null,
      completion7d,
      needsFollowUp: true,
    }),
  };
}

describe('buildPatientFollowUpQueue', () => {
  it('prioritizes patients with no recent record and then the oldest activity', () => {
    const result = buildPatientFollowUpQueue([
      candidate('three-days', 3),
      candidate('no-recent-log', null),
      candidate('six-days', 6),
    ]);
    expect(result.map((item) => item.uid)).toEqual([
      'no-recent-log',
      'six-days',
      'three-days',
    ]);
  });

  it('uses lower recorded completion as the tie-breaker', () => {
    const result = buildPatientFollowUpQueue([
      candidate('higher-completion', 4, 65),
      candidate('lower-completion', 4, 25),
    ]);
    expect(result.map((item) => item.uid)).toEqual([
      'lower-completion',
      'higher-completion',
    ]);
  });

  it('does not turn missing progress or non-follow-up patients into alerts', () => {
    const result = buildPatientFollowUpQueue([
      { uid: 'unknown', name: 'Unknown', progress: null },
      { uid: 'recent', name: 'Recent', progress: summary({ needsFollowUp: false }) },
    ]);
    expect(result).toEqual([]);
  });

  it('deduplicates patient ids and respects a safe result limit', () => {
    const result = buildPatientFollowUpQueue([
      candidate('same', 3),
      candidate('same', 8),
      candidate('another', 4),
      candidate('third', 5),
    ], 2);
    expect(result.map((item) => item.uid)).toEqual(['same', 'third']);
    expect(buildPatientFollowUpQueue([candidate('same', 3)], 0)).toEqual([]);
    expect(buildPatientFollowUpQueue([candidate('same', 3)], Number.NaN)).toEqual([]);
  });
});
