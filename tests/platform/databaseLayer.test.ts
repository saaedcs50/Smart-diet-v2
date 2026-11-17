// اختبارات طبقة البيانات — تحويلات خالصة بلا شبكة أو حسابات حقيقية.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUserProfile } from '../../src/platform/auth';
import {
  dayLogFromDatabase,
  dayLogToDatabase,
  planFromDatabase,
  planToDatabase,
  stripUndefinedDeep,
} from '../../src/platform/database';
import { isPlatformEnabled } from '../../src/platform/platformMode';
import type { DayLog, PlanConfig } from '../../src/types/index';

const dummyPlan = {
  clientName: 'مريض تجريبي',
  dailyWaterGoalMl: 2000,
  heightCm: 170,
  targetWeight: 70,
  targetWaist: null,
  freezeDaysPerMonth: 2,
  adminPin: '',
  scoreWeights: { water: 1, meals: 1, checks: 1, supps: 1, exercise: 1 },
  meals: [],
  checklist: [],
  supplements: [],
  tips: [],
  symptomsList: [],
} as unknown as PlanConfig;

const dummyDayLog = {
  water: 1500,
  waterLogs: 6,
  sleep: '23:00',
  wake: '07:00',
  quality: 'good',
  meals: {},
  checks: {},
  supps: {},
  notes: '',
  weight: 80,
  meas: {
    waist: null,
    chest: null,
    hips: null,
    arm: null,
    thigh: null,
    neck: null,
  },
  symptoms: {},
  symNotes: '',
  mood: 4,
  exercise: 30,
  isFreeze: false,
} as DayLog;

describe('platform mode flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('معطّل افتراضيًا بلا متغير بيئة', () => {
    expect(isPlatformEnabled()).toBe(false);
  });

  it('ينشط فقط بقيمة true الصريحة', () => {
    vi.stubEnv('VITE_PLATFORM_ENABLED', 'true');
    expect(isPlatformEnabled()).toBe(true);
    vi.stubEnv('VITE_PLATFORM_ENABLED', 'yes');
    expect(isPlatformEnabled()).toBe(false);
  });
});

describe('plan/dayLog converters', () => {
  it('planToDatabase يحذف adminPin وundefined ويضيف بيانات المزامنة', () => {
    const withUndefined = {
      ...dummyPlan,
      targetCalories: undefined,
      weeklyFocus: undefined,
    } as unknown as PlanConfig;
    const out = planToDatabase(withUndefined, 'editor-1') as unknown as Record<
      string,
      unknown
    >;
    expect('adminPin' in out).toBe(false);
    expect('targetCalories' in out).toBe(false);
    expect(out.updatedBy).toBe('editor-1');
    expect(out.updatedAt).toBeDefined();
    expect(out.clientName).toBe('مريض تجريبي');
  });

  it('dayLogToDatabase يحافظ على الحقول ويضيف بيانات المزامنة', () => {
    const out = dayLogToDatabase(dummyDayLog, 'editor-1');
    expect(out.water).toBe(1500);
    expect(out.updatedBy).toBe('editor-1');
    expect(out.updatedAt).toBeDefined();
  });

  it('stripUndefinedDeep ينظف المتداخل ويحافظ على المصفوفات', () => {
    const cleaned = stripUndefinedDeep({
      a: 1,
      b: undefined,
      nested: { c: undefined, d: [1, undefined, 3] },
    });
    expect(cleaned).toEqual({ a: 1, nested: { d: [1, undefined, 3] } });
  });

  it('planFromDatabase يقبل الصالح ويرفض الفاسد', () => {
    expect(planFromDatabase(dummyPlan)?.clientName).toBe('مريض تجريبي');
    expect(planFromDatabase(null)).toBeNull();
    expect(planFromDatabase({ clientName: 'x' })).toBeNull();
    expect(planFromDatabase({ clientName: 'x', meals: [], checklist: [] })).not.toBeNull();
  });

  it('dayLogFromDatabase يقبل الصالح ويرفض الفاسد', () => {
    expect(dayLogFromDatabase(dummyDayLog)?.water).toBe(1500);
    expect(dayLogFromDatabase({ water: 'x' })).toBeNull();
    expect(dayLogFromDatabase(null)).toBeNull();
  });
});

describe('parseUserProfile', () => {
  it('يقبل ملفًا صالحًا بكل دور', () => {
    for (const role of ['patient', 'coach', 'admin']) {
      const parsed = parseUserProfile('uid-1', {
        role,
        clinicId: 'clinic-a',
        email: 'test@example.com',
        displayName: 'عضو تجريبي',
      });
      expect(parsed?.role).toBe(role);
      expect(parsed?.clinicId).toBe('clinic-a');
      expect(parsed?.disabled).toBe(false);
    }
  });

  it('يرفض الدور غير المعروف والعيادة الفارغة وغير الكائن', () => {
    expect(
      parseUserProfile('uid-1', { role: 'superuser', clinicId: 'clinic-a' }),
    ).toBeNull();
    expect(
      parseUserProfile('uid-1', { role: 'patient', clinicId: '' }),
    ).toBeNull();
    expect(parseUserProfile('uid-1', null)).toBeNull();
    expect(parseUserProfile('uid-1', 'x')).toBeNull();
  });
});
