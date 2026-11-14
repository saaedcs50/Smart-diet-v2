import { describe, expect, it } from 'vitest';
import type { DayLog, PlanConfig } from '../src/types';
import { calculateWeightTargetProgress, isWithinLastCalendarDays, summarizePatientProgress } from '../src/platform/patientProgressSummary';

const today = new Date(2026, 10, 14);
const plan = {
  startWeight: 90,
  targetWeight: 80,
  dailyWaterGoalMl: 2000,
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
    expect(summary.completion7d).toBe(33.3);
    expect(summary.completionDays7d).toBe(1);
    expect(summary.currentWeightKg).toBe(87.5);
    expect(summary.weightChangeKg).toBe(-2.5);
    expect(summary.weightTargetProgressPercent).toBe(25);
    expect(summary.currentWaterMl).toBe(0);
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


describe('clinic adherence and target progress metrics', () => {
  it('includes meals, water and checklist in the comparable daily completion average', () => {
    const summary = summarizePatientProgress([
      {
        date: '2026-11-14',
        log: log({
          water: 0,
          meals: { m1: { type: 'default' } },
          checks: { c1: true },
        }),
      },
    ], plan, today);
    // Meal 50%, water 0%, checklist 50% => 33.3%.
    expect(summary.completion7d).toBe(33.3);
    expect(summary.completionDays7d).toBe(1);
  });

  it('calculates progress for both weight-loss and weight-gain goals', () => {
    expect(calculateWeightTargetProgress(90, 85, 80)).toBe(50);
    expect(calculateWeightTargetProgress(70, 73, 80)).toBe(30);
  });

  it('clamps target progress to the range 0–100 and handles invalid targets', () => {
    expect(calculateWeightTargetProgress(90, 95, 80)).toBe(0);
    expect(calculateWeightTargetProgress(90, 75, 80)).toBe(100);
    expect(calculateWeightTargetProgress(90, 85, 90)).toBeNull();
    expect(calculateWeightTargetProgress(null, 85, 80)).toBeNull();
  });
});


describe('new patient file date window', () => {
  it('counts records created within inclusive local calendar-day windows', () => {
    expect(isWithinLastCalendarDays('2026-11-08T10:00:00+02:00', 7, today)).toBe(true);
    expect(isWithinLastCalendarDays('2026-11-07T23:00:00+02:00', 7, today)).toBe(false);
    expect(isWithinLastCalendarDays('2026-10-16T12:00:00+02:00', 30, today)).toBe(true);
    expect(isWithinLastCalendarDays('2026-10-15T12:00:00+02:00', 30, today)).toBe(false);
  });

  it('rejects missing and malformed creation timestamps', () => {
    expect(isWithinLastCalendarDays(undefined, 7, today)).toBe(false);
    expect(isWithinLastCalendarDays('not-a-timestamp', 7, today)).toBe(false);
  });
});
