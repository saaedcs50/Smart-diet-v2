import { describe, it, expect } from 'vitest';
import { DEFAULT_PLAN } from '../src/utils/storage';
import { PlanConfig } from '../src/types';
import { IntakeAnswers, parseIntakeMedications, buildIntakeDraftPlan } from '../src/utils/intake';

function answers(patch: Partial<IntakeAnswers> = {}): IntakeAnswers {
  return {
    clientName: 'سارة أحمد',
    heightCm: 165,
    startWeight: 90,
    targetWeight: 70,
    targetWaist: 80,
    conditions: [],
    allergies: [],
    medicationsText: '',
    ...patch,
  };
}

describe('intake — medications parsing (Batch 2.5)', () => {
  it('parses “name - dose” lines without inventing a schedule', () => {
    const meds = parseIntakeMedications('ميتفورمين - 500 مجم\nفيتامين د - 5000 وحدة');
    expect(meds).toHaveLength(2);
    expect(meds[0].name).toBe('ميتفورمين');
    expect(meds[0].dose).toBe('500 مجم');
    expect(meds[0].timesPerDay).toBe(0);
    expect(meds[0].timings).toEqual([]);
    expect(meds[0].coachNotes).toContain('لم تُذكر مرات التناول');
    expect(meds[0].active).toBe(true);
  });

  it('name-only lines are kept with an empty dose', () => {
    const meds = parseIntakeMedications('أوميجا 3');
    expect(meds).toHaveLength(1);
    expect(meds[0].dose).toBe('');
  });

  it('empty text produces no medications', () => {
    expect(parseIntakeMedications('')).toEqual([]);
    expect(parseIntakeMedications('  \n ')).toEqual([]);
  });
});

describe('intake — answers → draft plan (Batch 2.5)', () => {
  it('fills identity and measurements and never mutates the base plan', () => {
    const base: PlanConfig = JSON.parse(JSON.stringify(DEFAULT_PLAN));
    const baseSnapshot = JSON.stringify(base);
    const draft = buildIntakeDraftPlan(answers(), base);
    expect(draft.clientName).toBe('سارة أحمد');
    expect(draft.heightCm).toBe(165);
    expect(draft.startWeight).toBe(90);
    expect(draft.targetWeight).toBe(70);
    expect(JSON.stringify(base)).toBe(baseSnapshot); // الخطة النشطة لم تُلمس
  });

  it('diabetes conditions enable lab + macros sections (sugar tracking)', () => {
    const draft = buildIntakeDraftPlan(
      answers({ conditions: [{ id: 't2dm', label: 'سكري نوع 2 (T2DM)' }] }),
      DEFAULT_PLAN
    );
    expect(draft.visibleSections?.labTracker).toBe(true);
    expect(draft.visibleSections?.macrosTracker).toBe(true);
    expect(draft.enableMacrosTracker).toBe(true);
    expect(draft.labTracking).toBeTruthy();
    expect(draft.medicalConditions?.conditions.map((c) => c.id)).toEqual(['t2dm']);
  });

  it('PCOS enables cycle tracking with the pcos clinical flag', () => {
    const draft = buildIntakeDraftPlan(
      answers({ conditions: [{ id: 'pcos', label: 'تكيس مبايض (PCOS)' }] }),
      DEFAULT_PLAN
    );
    expect(draft.cycleTracking?.enabled).toBe(true);
    expect(draft.cycleTracking?.clinicalFlags).toContain('pcos');
  });

  it('multiple conditions combine their section proposals', () => {
    const draft = buildIntakeDraftPlan(
      answers({
        conditions: [
          { id: 't2dm', label: 'سكري نوع 2 (T2DM)' },
          { id: 'pcos', label: 'تكيس مبايض (PCOS)' },
          { id: 'hypertension', label: 'ضغط مرتفع' },
        ],
      }),
      DEFAULT_PLAN
    );
    expect(draft.visibleSections?.labTracker).toBe(true);
    expect(draft.cycleTracking?.enabled).toBe(true);
    expect(draft.medicalConditions?.conditions).toHaveLength(3);
  });

  it('no conditions keeps the base sections untouched', () => {
    const draft = buildIntakeDraftPlan(answers(), DEFAULT_PLAN);
    expect(draft.cycleTracking?.enabled ?? false).toBe(DEFAULT_PLAN.cycleTracking?.enabled ?? false);
    expect(draft.medicalConditions?.conditions).toEqual([]);
  });

  it('medications and allergies land in the draft; fasting type enables fastingPlan', () => {
    const draft = buildIntakeDraftPlan(
      answers({
        medicationsText: 'ميتفورمين - 500 مجم',
        allergies: ['جلوتين'],
        fastingType: 'intermittent',
        goal: 'نزول 10 كجم',
      }),
      DEFAULT_PLAN
    );
    expect(draft.medicationPlan?.items).toHaveLength(1);
    expect(draft.medicationPlan?.items[0].name).toBe('ميتفورمين');
    expect(draft.medicalConditions?.allergies).toEqual(['جلوتين']);
    expect(draft.fastingPlan?.enabled).toBe(true);
    expect(draft.fastingPlan?.type).toBe('intermittent');
    expect(draft.medicalConditions?.customConditionNotes).toContain('نزول 10 كجم');
  });

  it('draft keeps the conservative default meals from the base plan', () => {
    const draft = buildIntakeDraftPlan(answers(), DEFAULT_PLAN);
    expect(draft.meals.map((m) => m.id)).toEqual(DEFAULT_PLAN.meals.map((m) => m.id));
  });
});
