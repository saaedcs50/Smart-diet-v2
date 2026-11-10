import { describe, expect, it } from 'vitest';
import type { ClinicSummary } from '../../src/platform/owner';
import { daysRemaining, summarizeOwnerDashboard } from '../../src/platform/ownerDashboard';

function clinic(
  id: string,
  status: ClinicSummary['status'],
  subscription: ClinicSummary['subscription'],
): ClinicSummary {
  return {
    id,
    name: id,
    ownerUid: '',
    ownerName: '',
    ownerPhone: '',
    status,
    subscription,
  };
}

describe('owner dashboard metrics', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');

  it('counts clinic and subscription states without mixing administrative suspension', () => {
    const rows = [
      clinic('active', 'active', {
        plan: 'monthly',
        status: 'active',
        expiresAt: '2026-11-25T12:00:00.000Z',
        payments: [],
      }),
      clinic('grace', 'active', {
        plan: 'monthly',
        status: 'grace',
        expiresAt: '2026-11-01T00:00:00.000Z',
        payments: [],
      }),
      clinic('expired', 'active', {
        plan: 'monthly',
        status: 'expired',
        expiresAt: '2026-10-01T00:00:00.000Z',
        payments: [],
      }),
      clinic('suspended', 'suspended', {
        plan: 'annual',
        status: 'active',
        expiresAt: '2027-11-01T00:00:00.000Z',
        payments: [],
      }),
      clinic('permanent', 'active', {
        plan: 'permanent',
        status: 'active',
        expiresAt: null,
        payments: [],
      }),
    ];

    const result = summarizeOwnerDashboard(rows, now);
    expect(result.totalClinics).toBe(5);
    expect(result.activeSubscriptions).toBe(2);
    expect(result.graceSubscriptions).toBe(1);
    expect(result.expiredOrUnsubscribed).toBe(1);
    expect(result.suspendedClinics).toBe(1);
    expect(result.expiringWithin30Days).toBe(1);
  });

  it('counts only reviewed, non-rejected payments inside the six-month window', () => {
    const rows = [
      clinic('payments', 'active', {
        plan: 'annual',
        status: 'active',
        payments: [
          {
            method: 'instapay',
            amount: 500,
            currency: 'EGP',
            reference: 'A',
            reviewedAt: '2026-11-02T10:00:00.000Z',
          },
          {
            method: 'vodafone_cash',
            amount: 300,
            currency: 'EGP',
            reference: 'B',
            reviewedAt: '2026-11-03T10:00:00.000Z',
            note: 'مرفوض: مرجع غير صحيح',
          },
          {
            method: 'instapay',
            amount: 200,
            currency: 'EGP',
            reference: 'C',
          },
          {
            method: 'instapay',
            amount: 900,
            currency: 'EGP',
            reference: 'D',
            reviewedAt: '2026-04-01T10:00:00.000Z',
          },
        ],
      }),
    ];

    const result = summarizeOwnerDashboard(rows, now);
    expect(result.approvedPaymentsLastSixMonths).toBe(500);
    expect(result.pendingPaymentCount).toBe(1);
    expect(result.monthlyApprovedPayments.find((month) => month.key === '2026-11')?.amount).toBe(500);
  });

  it('parses Supabase ISO timestamps for remaining days', () => {
    expect(daysRemaining('2026-11-15T12:00:00.000Z', now)).toBe(5);
    expect(daysRemaining(null, now)).toBeNull();
    expect(daysRemaining('not-a-date', now)).toBeNull();
  });
});
