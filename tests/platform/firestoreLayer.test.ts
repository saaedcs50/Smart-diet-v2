// اختبارات طبقة المنصة — المرحلة الأولى.
// بلا شبكة وبلا مستخدمين حقيقيين: الدوال الخالصة (التحويل، المسارات،
// التحقق من الملف) + مفتاح الوضع. عمليات القراءة/الكتابة الفعلية لا تُختبر
// هنا لأنها تحتاج محاكي Firestore، وهي خارج نطاق هذه المرحلة.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUserProfile } from '../../src/platform/auth';
import {
  clinicRef,
  consentRef,
  dayLogFromFirestore,
  dayLogRef,
  dayLogToFirestore,
  dayLogsCollection,
  patientRef,
  photoRef,
  planFromFirestore,
  planToFirestore,
  stripUndefinedDeep,
  userRef,
} from '../../src/platform/firestore';
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

describe('firestore paths', () => {
  it('مسارات المستندات مطابقة لنموذج §٣', () => {
    expect(clinicRef('clinic-a').path).toBe('clinics/clinic-a');
    expect(userRef('uid-1').path).toBe('users/uid-1');
    expect(patientRef('uid-1').path).toBe('patients/uid-1');
    expect(dayLogRef('uid-1', '2026-10-24').path).toBe(
      'patients/uid-1/dayLogs/2026-10-24',
    );
    expect(dayLogsCollection('uid-1').path).toBe('patients/uid-1/dayLogs');
    expect(consentRef('uid-1', 'sync').path).toBe(
      'patients/uid-1/consents/sync',
    );
    expect(photoRef('uid-1', 'p1').path).toBe('patients/uid-1/photos/p1');
  });
});

describe('plan/dayLog converters', () => {
  it('planToFirestore يحذف adminPin وundefined ويضيف بيانات المزامنة', () => {
    const withUndefined = {
      ...dummyPlan,
      targetCalories: undefined,
      weeklyFocus: undefined,
    } as unknown as PlanConfig;
    const out = planToFirestore(withUndefined, 'editor-1') as unknown as Record<
      string,
      unknown
    >;
    expect('adminPin' in out).toBe(false);
    expect('targetCalories' in out).toBe(false);
    expect(out.updatedBy).toBe('editor-1');
    expect(out.updatedAt).toBeDefined();
    expect(out.clientName).toBe('مريض تجريبي');
  });

  it('dayLogToFirestore يحافظ على الحقول ويضيف بيانات المزامنة', () => {
    const out = dayLogToFirestore(dummyDayLog, 'editor-1');
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

  it('planFromFirestore يقبل الصالح ويرفض الفاسد', () => {
    expect(planFromFirestore(dummyPlan)?.clientName).toBe('مريض تجريبي');
    expect(planFromFirestore(null)).toBeNull();
    expect(planFromFirestore({ clientName: 'x' })).toBeNull();
    expect(planFromFirestore({ clientName: 'x', meals: [], checklist: [] })).not.toBeNull();
  });

  it('dayLogFromFirestore يقبل الصالح ويرفض الفاسد', () => {
    expect(dayLogFromFirestore(dummyDayLog)?.water).toBe(1500);
    expect(dayLogFromFirestore({ water: 'x' })).toBeNull();
    expect(dayLogFromFirestore(null)).toBeNull();
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
