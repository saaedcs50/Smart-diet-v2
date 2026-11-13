import { describe, expect, it, vi } from 'vitest';
import { PUSH_DELIVERY_ENABLED as SERVER_PUSH_DELIVERY_ENABLED } from '../../supabase/functions/notify/pushGate';
import {
  isFcmConfigured,
  isPushDeliveryEnabled,
  notifyPatient,
  registerFcmToken,
} from '../../src/platform/fcm';

describe('Web Push safety gate', () => {
  it('keeps delivery disabled until RFC 8291 encryption is implemented', () => {
    expect(isPushDeliveryEnabled()).toBe(false);
    expect(SERVER_PUSH_DELIVERY_ENABLED).toBe(false);
    expect(isFcmConfigured()).toBe(false);
  });

  it('does not request or register a browser push subscription while disabled', async () => {
    await expect(registerFcmToken('synthetic-patient')).resolves.toBeNull();
  });

  it('does not issue a network request while delivery is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      notifyPatient('synthetic-patient', 'Test', 'Test body', 'synthetic-token'),
    ).rejects.toThrow('RFC 8291');

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
