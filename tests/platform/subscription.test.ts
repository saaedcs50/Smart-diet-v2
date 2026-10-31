// اختبارات وحدة لمنطق الاشتراك (الدوال الخالصة).

import { describe, it, expect } from 'vitest';
import { daysUntilExpiry } from '../../src/platform/subscription';
import type { ClinicSubscriptionDoc } from '../../src/platform/subscription';

function subWithExpiry(daysFromNow: number): ClinicSubscriptionDoc {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  return {
    plan: 'monthly',
    status: 'active',
    expiresAt: { toDate: () => d } as unknown as ClinicSubscriptionDoc['expiresAt'],
    payments: [],
  };
}

describe('subscription — daysUntilExpiry', () => {
  it('الدائم: null', () => {
    const s = subWithExpiry(100);
    s.plan = 'permanent';
    expect(daysUntilExpiry(s)).toBeNull();
  });

  it('بلا اشتراك: null', () => {
    expect(daysUntilExpiry(null)).toBeNull();
  });

  it('متبقٍ 10 أيام → 10', () => {
    expect(daysUntilExpiry(subWithExpiry(10))).toBe(10);
  });

  it('منتهٍ منذ يومين → سالب', () => {
    const days = daysUntilExpiry(subWithExpiry(-2));
    expect(days).not.toBeNull();
    expect(days!).toBeLessThanOrEqual(0);
  });
});
