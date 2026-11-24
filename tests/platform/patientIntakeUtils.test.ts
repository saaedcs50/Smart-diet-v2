import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN } from '../../src/utils/storage';
import type { IntakeAnswers } from '../../src/utils/intake';
import {
  buildPatientIntakeDraftPlan,
  splitPatientIntakeList,
  validatePatientIntakeAnswers,
} from '../../src/platform/patientIntakeUtils';

const valid: IntakeAnswers = {
  clientName: 'مريض تجريبي',
  heightCm: 170,
  startWeight: 85,
  targetWeight: 70,
  targetWaist: null,
  conditions: [{ id: 'ibs', label: 'قولون عصبي (IBS)' }],
  allergies: ['لاكتوز'],
  medicationsText: 'دواء تجريبي - 500 مجم',
  sleepHours: 7,
  activityLevel: 'moderate',
  fastingType: 'none',
  goal: 'تحسين العادات',
  notes: '',
};

describe('patient intake validation', () => {
  it('splits, normalizes and removes duplicate allergy items', () => {
    expect(splitPatientIntakeList(' لاكتوز، جلوتين; لاكتوز\nسمسم ')).toEqual([
      'لاكتوز',
      'جلوتين',
      'سمسم',
    ]);
  });

  it('accepts a valid, non-empty intake record', () => {
    expect(validatePatientIntakeAnswers(valid)).toBeNull();
  });

  it('rejects empty health values so an accidental blank form is not submitted', () => {
    expect(validatePatientIntakeAnswers({
      ...valid,
      heightCm: null,
      startWeight: null,
      targetWeight: null,
      targetWaist: null,
      conditions: [],
      allergies: [],
      medicationsText: '',
      goal: '',
      notes: '',
    })).toContain('معلومة واحدة على الأقل');
  });

  it('rejects implausible measurements', () => {
    expect(validatePatientIntakeAnswers({ ...valid, heightCm: 400 })).toContain('الطول');
    expect(validatePatientIntakeAnswers({ ...valid, sleepHours: 26 })).toContain('ساعات النوم');
  });

  it('rejects oversized medication and note payloads', () => {
    expect(validatePatientIntakeAnswers({ ...valid, medicationsText: 'x'.repeat(2001) })).toContain('الأدوية');
    expect(validatePatientIntakeAnswers({ ...valid, notes: 'x'.repeat(2001) })).toContain('الملاحظات');
  });
});


describe('patient intake draft generation', () => {
  it('builds a separate hidden draft without mutating the active plan', () => {
    const basePlan = JSON.parse(JSON.stringify(DEFAULT_PLAN)) as typeof DEFAULT_PLAN;
    const before = JSON.stringify(basePlan);
    const answersWithConditions: IntakeAnswers = {
      ...valid,
      conditions: [
        { id: 't2dm', label: 'سكري نوع 2 (T2DM)' },
        { id: 'pcos', label: 'تكيس مبايض (PCOS)' },
      ],
      medicationsText: 'دواء تجريبي - 500 مجم',
      fastingType: 'intermittent',
    };

    const draft = buildPatientIntakeDraftPlan(answersWithConditions, basePlan);

    expect(draft.clientName).toBe(valid.clientName);
    expect(draft.heightCm).toBe(valid.heightCm);
    expect(draft.medicalConditions?.showToClient).toBe(false);
    expect(draft.goal).toBe('تحسين العادات');
    expect(draft.notes).toContain('7 ساعة يوميًا');
    expect(draft.notes).toContain('متوسط');
    expect(draft.adminPin).toBe('');
    expect(draft.medicationPlan?.showToClient).toBe(false);
    expect(draft.labTracking?.showToClient).toBe(false);
    expect(draft.cycleTracking?.showPhaseToClient).toBe(false);
    expect(draft.medicationPlan?.items[0].timesPerDay).toBe(0);
    expect(draft.medicationPlan?.items[0].timings).toEqual([]);
    expect(JSON.stringify(basePlan)).toBe(before);
  });

  it('does not enable hidden clinical sections when no condition was submitted', () => {
    const draft = buildPatientIntakeDraftPlan(valid, DEFAULT_PLAN);
    expect(draft.medicalConditions?.showToClient).toBe(false);
    expect(draft.medicationPlan?.showToClient).toBe(false);
    expect(draft.medicationPlan?.items[0].timesPerDay).toBe(0);
    expect(draft.medicationPlan?.items[0].timings).toEqual([]);
  });
});

describe('patient intake runtime JSON validation', () => {
  it('rejects malformed condition and allergy arrays before conversion', () => {
    expect(validatePatientIntakeAnswers({
      ...valid,
      conditions: [null] as unknown as IntakeAnswers['conditions'],
    })).toContain('الحالة الصحية');
    expect(validatePatientIntakeAnswers({
      ...valid,
      allergies: [42] as unknown as string[],
    })).toContain('الحساسية');
  });

  it('rejects a missing medication text field instead of throwing', () => {
    expect(validatePatientIntakeAnswers({
      ...valid,
      medicationsText: null as unknown as string,
    })).toContain('الأدوية');
  });

  it('rejects condition IDs and labels that are not in the supported condition catalog', () => {
    expect(validatePatientIntakeAnswers({
      ...valid,
      conditions: [{ id: 'made-up-diagnosis', label: 'تشخيص غير موجود' }],
    })).toContain('قائمة الحالات المعتمدة');
    expect(validatePatientIntakeAnswers({
      ...valid,
      conditions: [{ id: 't2dm', label: 'اسم مختلف' }],
    })).toContain('قائمة الحالات المعتمدة');
  });
});
