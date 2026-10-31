// اختبارات وحدة لمنطق صاحب المنصة (الدوال الخالصة).

import { describe, it, expect } from 'vitest';
import { expiryForPlan } from '../../src/platform/owner';

describe('owner — expiryForPlan', () => {
  const base = new Date('2026-01-15T12:00:00Z');

  it('الدائم: بلا انتهاء (null)', () => {
    expect(expiryForPlan('permanent', base)).toBeNull();
  });

  it('الشهري: + شهر واحد', () => {
    const d = expiryForPlan('monthly', base);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(1); // فبراير
    expect(d!.getUTCDate()).toBe(15);
  });

  it('السنوي: + 12 شهرًا', () => {
    const d = expiryForPlan('annual', base);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2027);
    expect(d!.getUTCMonth()).toBe(0); // يناير
    expect(d!.getUTCDate()).toBe(15);
  });
});
