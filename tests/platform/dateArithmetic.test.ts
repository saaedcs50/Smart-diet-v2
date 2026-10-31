// اختبارات SDV2-BUG-001: تثبيت اليوم عند جمع الأشهر.

import { describe, it, expect } from 'vitest';
import { addMonthsLocked, expiryForPlan } from '../../src/platform/owner';

describe('addMonthsLocked — SDV2-BUG-001', () => {
  it('31 يناير + شهر = 28 فبراير (لا قفزة لمارس)', () => {
    const d = addMonthsLocked(new Date(2026, 0, 31), 1);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // فبراير
    expect(d.getDate()).toBe(28);
  });

  it('31 يناير + شهر في سنة كبيسة = 29 فبراير', () => {
    const d = addMonthsLocked(new Date(2024, 0, 31), 1);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it('31 مارس + شهر = 30 أبريل', () => {
    const d = addMonthsLocked(new Date(2026, 2, 31), 1);
    expect(d.getMonth()).toBe(3); // أبريل
    expect(d.getDate()).toBe(30);
  });

  it('يوم عادي لا يتأثر', () => {
    const d = addMonthsLocked(new Date(2026, 5, 15), 1);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
  });

  it('expiryForPlan الشهري من 31 يناير لا يقفز', () => {
    const d = expiryForPlan('monthly', new Date(2026, 0, 31));
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(1);
    expect(d!.getDate()).toBe(28);
  });
});
