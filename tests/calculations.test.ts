import { describe, it, expect } from 'vitest';
import {
  calculateMifflinStJeor,
  calculateKatchMcArdle,
  calculateIBW,
  calculateBMI as clinicalBMI,
  calculateWHtR,
  calculateDailyFluid,
} from '../src/utils/clinicalCalculators';
import {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calculateREE_Kholoud,
  calculateREE_MifflinStJeor,
  KHOLOUD_REE_META,
  MIFFLIN_ST_JEOR_META,
} from '../src/utils/calculations';

describe('clinicalCalculators — BMR formulas', () => {
  it('Mifflin-St Jeor: male 80kg / 180cm / 30y = 1780', () => {
    expect(
      calculateMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, gender: 'male' })
    ).toBe(1780);
  });

  it('Mifflin-St Jeor: female 80kg / 180cm / 30y = 1614', () => {
    expect(
      calculateMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, gender: 'female' })
    ).toBe(1614);
  });

  it('Katch-McArdle: 80kg @ 20% body fat = 1752', () => {
    expect(calculateKatchMcArdle(80, 20)).toBe(1752);
  });

  it('calculateBMR classic Mifflin matches the classic formula', () => {
    expect(calculateBMR(80, 180, 30, 'male', true)).toBe(1780);
    expect(calculateBMR(80, 180, 30, 'female', true)).toBe(1614);
  });

  it('calculateBMR guards invalid input (Kholoud REE returns 0)', () => {
    expect(calculateBMR(0, 180, 30)).toBe(0);
    expect(calculateBMR(80, 0, 30)).toBe(0);
  });
});

// SDV2-CLIN-001: REE equation labeling — both equations tested, labels verified
describe('REE equation metadata (SDV2-CLIN-001)', () => {
  it('Kholoud REE metadata is labeled as internal (not Mifflin)', () => {
    expect(KHOLOUD_REE_META.name).toBe('Kholoud REE');
    expect(KHOLOUD_REE_META.isStandardMifflin).toBe(false);
    expect(KHOLOUD_REE_META.source).toContain('internal');
  });

  it('Mifflin-St Jeor metadata is labeled as standard', () => {
    expect(MIFFLIN_ST_JEOR_META.name).toBe('Mifflin-St Jeor');
    expect(MIFFLIN_ST_JEOR_META.isStandardMifflin).toBe(true);
  });

  it('calculateREE_MifflinStJeor matches standard formula', () => {
    // Male: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateREE_MifflinStJeor(80, 180, 30, 'male')).toBe(1780);
    // Female: 10*80 + 6.25*180 - 5*30 - 161 = 800 + 1125 - 150 - 161 = 1614
    expect(calculateREE_MifflinStJeor(80, 180, 30, 'female')).toBe(1614);
  });

  it('calculateREE_MifflinStJeor guards invalid input', () => {
    expect(calculateREE_MifflinStJeor(0, 180, 30, 'male')).toBe(0);
    expect(calculateREE_MifflinStJeor(80, 0, 30, 'female')).toBe(0);
  });

  it('Kholoud REE differs from Mifflin-St Jeor (documents the distinction)', () => {
    const kholoud = calculateREE_Kholoud(80, 180, 30);
    const mifflinMale = calculateREE_MifflinStJeor(80, 180, 30, 'male');
    // They should differ — this is the documented distinction in SDV2-CLIN-001
    expect(kholoud).not.toBe(mifflinMale);
  });
});

describe('clinicalCalculators — IBW / BMI / WHtR', () => {
  it('IBW male 180cm: Devine ≈ 75.0, Hamwi ≈ 77.3', () => {
    const r = calculateIBW(180, 'male');
    expect(r.devine).toBeCloseTo(75.0, 1);
    expect(r.hamwi).toBeCloseTo(77.3, 1);
  });

  it('IBW female 165cm: Devine ≈ 56.9, Hamwi ≈ 56.4', () => {
    const r = calculateIBW(165, 'female');
    expect(r.devine).toBeCloseTo(56.9, 1);
    expect(r.hamwi).toBeCloseTo(56.4, 1);
  });

  it('clinical BMI: 80kg/180cm = 24.7 with normal category', () => {
    const r = clinicalBMI(80, 180);
    expect(r.bmi).toBe(24.7);
    expect(r.categoryAr).toContain('Normal');
  });

  it('clinical BMI: missing height returns bmi 0 / غير محدد', () => {
    const r = clinicalBMI(80, 0);
    expect(r.bmi).toBe(0);
    expect(r.categoryAr).toBe('غير محدد');
  });

  it('WHtR: 90cm waist / 180cm = 0.5 healthy', () => {
    const r = calculateWHtR(90, 180);
    expect(r.ratio).toBe(0.5);
    expect(r.categoryAr).toContain('صحي ومثالي');
  });
});

describe('clinicalCalculators — fluids', () => {
  it('DailyFluid 70kg: base 2.5L (Holliday-Segar beats 35ml/kg)', () => {
    const r = calculateDailyFluid(70, 3);
    expect(r.baseLiters).toBe(2.5);
    expect(r.totalLiters).toBe(2.7);
  });
});

describe('calculations — display BMI & TDEE', () => {
  it('display BMI formats 24.7 for 80kg/180cm', () => {
    expect(calculateBMI(80, 180).val).toBe('24.7');
  });

  it('display BMI returns placeholder for missing data', () => {
    expect(calculateBMI(null, 180).val).toBe('--');
    expect(calculateBMI(80, null).val).toBe('--');
  });

  it('TDEE multipliers: male 1.6 / female 1.5 / sedentary 1.2 / custom', () => {
    expect(calculateTDEE(1780, 'male')).toBe(2848);
    expect(calculateTDEE(1780, 'female')).toBe(2670);
    expect(calculateTDEE(2000, 'sedentary')).toBe(2400);
    expect(calculateTDEE(2000, 1.9)).toBe(3800);
  });
});
