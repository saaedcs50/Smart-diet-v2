import { describe, expect, it } from 'vitest';
import {
  createEmptyPatientPlan,
  validatePatientPlan,
} from '../../src/platform/patientPlanEditor';

function validPlan() {
  const plan = createEmptyPatientPlan('مريض تجريبي');
  return {
    ...plan,
    dailyWaterGoalMl: 2000,
    meals: [{
      id: 'meal-1',
      name: 'الإفطار',
      items: 'بيضتان (100 جم) وخبز 60 جم',
      alternatives: ['جبن قريش 100 جم'],
      time: '08:30',
    }],
    checklist: [{ id: 'check-1', label: 'تسجيل شرب الماء' }],
  };
}

describe('patient plan editor validation', () => {
  it('requires a valid daily water target for a new cloud plan', () => {
    const plan = createEmptyPatientPlan('مريض تجريبي');
    const errors = validatePatientPlan(plan);
    expect(errors.some((error) => error.includes('هدف الماء اليومي'))).toBe(true);
  });

  it('accepts clinician-entered meals, quantities, time and checklist items', () => {
    expect(validatePatientPlan(validPlan())).toEqual([]);
  });

  it('rejects impossible units and values without mutating the draft', () => {
    const plan = validPlan();
    plan.heightCm = 900;
    plan.dailyWaterGoalMl = 150000;
    const before = JSON.stringify(plan);
    const errors = validatePatientPlan(plan);
    expect(errors.some((error) => error.includes('الطول'))).toBe(true);
    expect(errors.some((error) => error.includes('هدف الماء اليومي'))).toBe(true);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('rejects missing meal content, invalid time and duplicate identifiers', () => {
    const plan = validPlan();
    plan.meals[0].items = ' ';
    plan.meals[0].time = '27:90';
    plan.checklist.push({ id: 'check-1', label: 'بند آخر' });
    const errors = validatePatientPlan(plan);
    expect(errors.some((error) => error.includes('المكونات والكميات'))).toBe(true);
    expect(errors.some((error) => error.includes('الوقت'))).toBe(true);
    expect(errors.some((error) => error.includes('معرّف مكرر'))).toBe(true);
  });

  it('validates medicine names, dose counts and maximum lengths', () => {
    const plan = validPlan();
    plan.medicationPlan = {
      showToClient: true,
      lastUpdatedBy: 'coach',
      items: [{
        id: 'med-1',
        name: '',
        dose: 'x'.repeat(121),
        timesPerDay: 9,
        timings: [{ id: 'time-1', slot: 'morning', label: 'صباحًا' }],
        active: true,
      }],
    };
    const errors = validatePatientPlan(plan);
    expect(errors.some((error) => error.includes('اسم الدواء'))).toBe(true);
    expect(errors.some((error) => error.includes('الجرعة'))).toBe(true);
    expect(errors.some((error) => error.includes('مرات التناول'))).toBe(true);
  });
});
