import { describe, expect, it } from 'vitest';
import { summarizePatientDayLog } from '../../src/platform/patientDashboardMetrics';

describe('summarizePatientDayLog', () => {
  it('counts only explicitly selected meals and completed checklist items', () => {
    const result = summarizePatientDayLog(
      {
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
      } as never,
      {
        meals: [{}, {}, {}],
        checklist: [{}, {}, {}, {}],
      } as never,
    );

    expect(result).toEqual({
      recordedMeals: 2,
      plannedMeals: 3,
      completedTasks: 2,
      plannedTasks: 4,
    });
  });

  it('does not invent a planned total when there is no cloud plan', () => {
    const result = summarizePatientDayLog(
      { meals: {}, checks: { water: true } } as never,
      null,
    );

    expect(result).toEqual({
      recordedMeals: 0,
      plannedMeals: null,
      completedTasks: 1,
      plannedTasks: null,
    });
  });
});
