import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPushDeliveryEnabled,
  notifyPatient,
  registerPushSubscription,
} from '../../src/platform/push';

describe('clinic Web Push', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requires a valid P-256 public key and Supabase client configuration', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    expect(isPushDeliveryEnabled()).toBe(false);

    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(isPushDeliveryEnabled()).toBe(true);
  });

  it('does not attempt registration when browser push APIs are unavailable', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('window', undefined);
    await expect(registerPushSubscription('synthetic-patient')).resolves.toBeNull();
  });

  it('calls the Supabase notify Edge Function directly with the signed-in caller token', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://smart-diet-test.supabase.co/');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sent: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(notifyPatient('patient-uid', 'supabase-user-access-token'))
      .resolves.toEqual({ ok: true, sent: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://smart-diet-test.supabase.co/functions/v1/notify');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer supabase-user-access-token');
    expect(new Headers(options.headers).get('apikey')).toBe('public-test-key');
    expect(JSON.parse(String(options.body))).toEqual({ patientUid: 'patient-uid' });
  });
});
