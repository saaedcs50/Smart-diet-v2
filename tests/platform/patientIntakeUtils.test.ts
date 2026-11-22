import { describe, expect, it } from 'vitest';
import type { IntakeAnswers } from '../../src/utils/intake';
import {
  splitPatientIntakeList,
  validatePatientIntakeAnswers,
} from '../../src/platform/patientIntakeUtils';

const valid: IntakeAnswers = {
  clientName: 'مريض تجريبي',
  heightCm: 170,
  startWeight: 85,
  targetWeight: 70,
  targetWaist: null,
  conditions: [{ id: 'ibs', label: 'قولون عصبي' }],
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
