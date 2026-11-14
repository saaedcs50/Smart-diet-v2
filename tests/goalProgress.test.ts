import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN, createEmptyDayLog } from '../src/utils/storage';
import { calculateGoalProgressSummary } from '../src/utils/goalProgress';
import type { DayLog } from '../src/types';

describe('goal progress summary', () => {
  it('uses the latest recorded weight before the selected date and excludes future entries', () => {
    const logs: Record<string, DayLog> = {
      '2026-11-10': { ...createEmptyDayLog(), weight: 82.4 },
      '2026-11-12': { ...createEmptyDayLog(), weight: 81.8 },
      '2026-11-15': { ...createEmptyDayLog(), weight: 70 },
    };
    const summary = calculateGoalProgressSummary(
      { ...DEFAULT_PLAN, targetWeight: 75 },
      '2026-11-14',
      logs,
    );

    expect(summary.currentWeight).toBe(81.8);
    expect(summary.targetWeight).toBe(75);
    expect(summary.remainingKg).toBe(6.8);
    expect(summary.passedTargetKg).toBeNull();
  });

  it('does not treat missing days as zero adherence and handles a crossed target descriptively', () => {
    const day = {
      ...createEmptyDayLog(),
      weight: 73,
      water: 2500,
      isFreeze: true,
    };
    const logs: Record<string, DayLog> = { '2026-11-14': day };
    const summary = calculateGoalProgressSummary(
      { ...DEFAULT_PLAN, targetWeight: 75 },
      '2026-11-14',
      logs,
    );

    expect(summary.currentWeight).toBe(73);
    expect(summary.remainingKg).toBeNull();
    expect(summary.passedTargetKg).toBe(2);
    expect(summary.loggedDays).toBe(1);
    expect(summary.weeklyAdherence).toBe(100);
  });

  it('returns no weight target metrics when a valid target has not been configured', () => {
    const summary = calculateGoalProgressSummary(
      { ...DEFAULT_PLAN, targetWeight: 0 },
      '2026-11-14',
      {},
    );
    expect(summary.currentWeight).toBeNull();
    expect(summary.targetWeight).toBeNull();
    expect(summary.weeklyAdherence).toBeNull();
  });
});
