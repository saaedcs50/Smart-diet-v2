import { describe, expect, it } from 'vitest';
import type { DayLog, PlanConfig } from '../../src/types';
import { summarizePatientDayLog } from '../../src/platform/patientDashboardMetrics';

describe('summarizePatientDayLog', () => {
  it('counts only explicitly selected meals and completed checklist items', () => {
    const log = {
      meals: {
        breakfast: { type: 'default' },
        lunch: { type: 'alt' },
        dinner: { type: 'none' },
        snack: {},
      },
      checks: {
        water: true,
        walk: false,
        sleep: true,
      },
    } satisfies Pick<DayLog, 'meals' | 'checks'>;

    const plan = {
      meals: [
        { id: 'breakfast', name: 'إفطار', items: '', alternatives: [] },
        { id: 'lunch', name: 'غداء', items: '', alternatives: [] },
        { id: 'dinner', name: 'عشاء', items: '', alternatives: [] },
      ],
      checklist: [
        { id: 'water', label: 'الماء' },
        { id: 'walk', label: 'المشي' },
        { id: 'sleep', label: 'النوم' },
        { id: 'stretch', label: 'التمدد' },
      ],
    } satisfies Pick<PlanConfig, 'meals' | 'checklist'>;

    expect(summarizePatientDayLog(log, plan)).toEqual({
      recordedMeals: 2,
      plannedMeals: 3,
      completedTasks: 2,
      plannedTasks: 4,
    });
  });

  it('does not invent a planned total when there is no cloud plan', () => {
    const log = {
      meals: {},
      checks: { water: true },
    } satisfies Pick<DayLog, 'meals' | 'checks'>;

    expect(summarizePatientDayLog(log, null)).toEqual({
      recordedMeals: 0,
      plannedMeals: null,
      completedTasks: 1,
      plannedTasks: null,
    });
  });
});
