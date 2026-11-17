import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPushDeliveryEnabled,
  registerPushSubscription,
} from '../../src/platform/push';

describe('clinic Web Push', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requires a public delivery key and Supabase client configuration', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    expect(isPushDeliveryEnabled()).toBe(false);

    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BElongTestPublicKey');
    expect(isPushDeliveryEnabled()).toBe(true);
  });

  it('does not attempt registration when browser push APIs are unavailable', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BElongTestPublicKey');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('window', undefined);
    await expect(registerPushSubscription('synthetic-patient')).resolves.toBeNull();
  });
});
