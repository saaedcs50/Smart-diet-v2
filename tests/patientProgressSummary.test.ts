import { describe, expect, it } from 'vitest';
import type { DayLog, PlanConfig } from '../src/types';
import { summarizePatientProgress } from '../src/platform/patientProgressSummary';

const today = new Date(2026, 10, 14);
const plan = {
  startWeight: 90,
  meals: [{ id: 'm1' }, { id: 'm2' }],
  checklist: [{ id: 'c1' }, { id: 'c2' }],
} as unknown as PlanConfig;

function log(overrides: Partial<DayLog> = {}): DayLog {
  return {
    water: 0,
    waterLogs: 0,
    sleep: '',
    wake: '',
    quality: '',
    meals: {},
    checks: {},
    supps: {},
    notes: '',
    weight: null,
    meas: { waist: null, chest: null, hips: null, arm: null, thigh: null, neck: null },
    symptoms: {},
    symNotes: '',
    mood: null,
    exercise: 0,
    isFreeze: false,
    ...overrides,
  };
}

describe('patient progress follow-up summaries', () => {
  it('identifies patients with no recent log as needing follow-up without inventing a score', () => {
    const summary = summarizePatientProgress([], plan, today);
    expect(summary.hasLogWithin30Days).toBe(false);
    expect(summary.lastLogDate).toBeNull();
    expect(summary.daysSinceLastLog).toBeNull();
    expect(summary.needsFollowUp).toBe(true);
    expect(summary.completion7d).toBeNull();
  });

  it('marks a patient for follow-up after three or more days without a record', () => {
    const summary = summarizePatientProgress([
      { date: '2026-11-10', log: log() },
    ], plan, today);
    expect(summary.lastLogDate).toBe('2026-11-10');
    expect(summary.daysSinceLastLog).toBe(4);
    expect(summary.needsFollowUp).toBe(true);
  });

  it('does not mark recent activity as overdue and reports completion separately', () => {
    const summary = summarizePatientProgress([
      {
        date: '2026-11-14',
        log: log({
          weight: 87.5,
          meals: { m1: { type: 'default' } },
          checks: { c1: true },
        }),
      },
    ], plan, today);
    expect(summary.needsFollowUp).toBe(false);
    expect(summary.completion7d).toBe(50);
    expect(summary.completionDays7d).toBe(1);
    expect(summary.currentWeightKg).toBe(87.5);
    expect(summary.weightChangeKg).toBe(-2.5);
  });

  it('ignores malformed dates and dates outside the 30-day window', () => {
    const summary = summarizePatientProgress([
      { date: '2026-10-01', log: log({ weight: 70 }) },
      { date: 'not-a-date', log: log({ weight: 65 }) },
    ], plan, today);
    expect(summary.hasLogWithin30Days).toBe(false);
    expect(summary.currentWeightKg).toBeNull();
  });

  it('does not calculate completion when the plan has no comparable items', () => {
    const emptyPlan = { meals: [], checklist: [] } as unknown as PlanConfig;
    const summary = summarizePatientProgress([
      { date: '2026-11-14', log: log() },
    ], emptyPlan, today);
    expect(summary.completion7d).toBeNull();
    expect(summary.completionDays7d).toBe(0);
  });
});
