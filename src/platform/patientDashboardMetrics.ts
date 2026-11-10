import type { DayLog, PlanConfig } from '../types';

export interface PatientDayLogSummary {
  recordedMeals: number;
  plannedMeals: number | null;
  completedTasks: number;
  plannedTasks: number | null;
}

/**
 * Counts explicit user-recorded meal choices and completed checklist items.
 * This is a display summary only; it does not assign a clinical/adherence score.
 */
export function summarizePatientDayLog(
  log: Pick<DayLog, 'meals' | 'checks'>,
  plan: Pick<PlanConfig, 'meals' | 'checklist'> | null,
): PatientDayLogSummary {
  return {
    recordedMeals: Object.values(log.meals ?? {}).filter(
      (meal) => meal.type === 'default' || meal.type === 'alt',
    ).length,
    plannedMeals: plan ? plan.meals.length : null,
    completedTasks: Object.values(log.checks ?? {}).filter(Boolean).length,
    plannedTasks: plan ? plan.checklist.length : null,
  };
}
