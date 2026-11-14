// اختبارات وحدة لمنطق الاشتراك وواجهة RPC الآمنة لطلبات التجديد.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/platform/supabase', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../../src/platform/supabase';
import {
  daysUntilExpiry,
  getSubscription,
  submitActivationRequest,
} from '../../src/platform/subscription';
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

describe('getSubscription', () => {
  it('uses the scoped gate RPC and does not select the payments JSONB field', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        plan: 'monthly',
        status: 'active',
        start_at: '2026-11-01T00:00:00.000Z',
        expires_at: '2026-12-01T00:00:00.000Z',
        grace_ends_at: null,
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ maybeSingle });
    vi.mocked(getSupabase).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabase>);

    const subscription = await getSubscription('clinic-a');
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('get_clinic_subscription_gate', {
      p_clinic_id: 'clinic-a',
    });
    expect(subscription?.status).toBe('active');
    expect(subscription?.payments).toEqual([]);
  });

  it('returns null when the caller cannot access the clinic gate', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'not authorized' },
    });
    const rpc = vi.fn().mockReturnValue({ maybeSingle });
    vi.mocked(getSupabase).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabase>);
    await expect(getSubscription('clinic-b')).resolves.toBeNull();
  });
});

describe('submitActivationRequest', () => {
  it('uses the atomic RPC and never reads/writes the payment array in the browser', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabase).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabase>);

    await submitActivationRequest('clinic-test', {
      requestId: '8c16f214-d4ec-4ff5-9e87-5f9e6a5ac310',
      method: 'instapay',
      amount: 250,
      reference: 'TRANSFER-123',
      note: 'renewal',
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('submit_clinic_payment_request', {
      p_clinic_id: 'clinic-test',
      p_request_id: '8c16f214-d4ec-4ff5-9e87-5f9e6a5ac310',
      p_method: 'instapay',
      p_amount: 250,
      p_reference: 'TRANSFER-123',
      p_note: 'renewal',
    });
  });

  it('surfaces database authorization and validation errors', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { message: 'Only an enabled clinic admin may submit a payment request' },
    });
    vi.mocked(getSupabase).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabase>);

    await expect(submitActivationRequest('clinic-test', {
      requestId: '8c16f214-d4ec-4ff5-9e87-5f9e6a5ac310',
      method: 'instapay',
      amount: 250,
      reference: 'TRANSFER-123',
    })).rejects.toThrow('Only an enabled clinic admin');
  });
});
