import { describe, it, expect } from 'vitest';
import {
  ABSENCE_THRESHOLD_DAYS,
  DEMO_PATIENTS,
  DEMO_PATIENT_DETAILS,
  getAbsentPatients,
} from '../src/prototype/prototypeData';

// اختبارات بيانات النموذج الثابت — منطق نقي بلا DOM ولا بيانات حقيقية.

describe('prototype demo data', () => {
  it('يحتوي على 5 مرضى تجريبيين على الأقل ببيانات مكتملة', () => {
    expect(DEMO_PATIENTS.length).toBeGreaterThanOrEqual(5);
    for (const p of DEMO_PATIENTS) {
      expect(p.alias.length).toBeGreaterThan(0);
      expect(p.todayAdherencePct).toBeGreaterThanOrEqual(0);
      expect(p.todayAdherencePct).toBeLessThanOrEqual(100);
      expect(p.weightKg).toBeGreaterThan(0);
      expect(p.daysAbsent).toBeGreaterThanOrEqual(0);
      expect(DEMO_PATIENT_DETAILS[p.id]).toBeDefined();
    }
  });

  it('كل تفاصيل مريض تشير لنفس ملخصه ونقاط وزن مرتبة', () => {
    for (const p of DEMO_PATIENTS) {
      const d = DEMO_PATIENT_DETAILS[p.id];
      expect(d.summary.id).toBe(p.id);
      expect(d.weightPoints.length).toBeGreaterThanOrEqual(2);
      expect(d.focusProgressPct).toBeGreaterThanOrEqual(0);
      expect(d.focusProgressPct).toBeLessThanOrEqual(100);
      expect(d.planMeals.length).toBeGreaterThan(0);
    }
  });

  it('تنبيه الغياب يلتقط الغائبين عند الحد فقط', () => {
    expect(ABSENCE_THRESHOLD_DAYS).toBe(3);
    const absent = getAbsentPatients(DEMO_PATIENTS);
    expect(absent.length).toBe(2);
    expect(absent.every((p) => p.daysAbsent >= ABSENCE_THRESHOLD_DAYS)).toBe(true);
    expect(absent.map((p) => p.id).sort()).toEqual(['demo-3', 'demo-5']);
  });

  it('البيانات الوهمية لا تحمل أي هوية شخصية حقيقية', () => {
    // الأنماط مبنية بتجميع مقاطع حتى لا يحتوي هذا الملف على النصوص نفسها.
    const forbidden = ['شيم' + 'اء', 'الفي' + 'شي', 'shi' + 'maa'];
    const haystack = JSON.stringify(DEMO_PATIENTS) + JSON.stringify(DEMO_PATIENT_DETAILS);
    for (const needle of forbidden) {
      expect(haystack.toLowerCase()).not.toContain(needle.toLowerCase());
    }
    // بلا أرقام هواتف في البيانات الوهمية
    expect(haystack).not.toMatch(/01\d{9}/);
    expect(haystack).not.toMatch(/201\d{10}/);
  });
});
