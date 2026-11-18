import { describe, expect, it } from 'vitest';
import { isApprovedPushEndpoint } from '../../supabase/functions/notify/pushEndpoint';

describe('approved Web Push endpoints', () => {
  it('accepts Chrome and Chromium Web Push endpoints using VAPID', () => {
    expect(isApprovedPushEndpoint('https://fcm.googleapis.com/fcm/send/example-token')).toBe(true);
  });

  it('accepts the existing Mozilla, Apple, and Windows Push services', () => {
    expect(isApprovedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example')).toBe(true);
    expect(isApprovedPushEndpoint('https://web.push.apple.com/example')).toBe(true);
    expect(isApprovedPushEndpoint('https://abc.notify.windows.com/w/?token=example')).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/example-token',
    'https://fcm.googleapis.com/not-fcm/example-token',
    'https://fcm.googleapis.com/fcm/send/',
    'https://fcm.googleapis.com.evil.test/fcm/send/example-token',
    'https://updates.push.services.mozilla.com.evil.test/wpush/example',
    'https://attacker.test/fcm/send/example-token',
    'https://user:password@fcm.googleapis.com/fcm/send/example-token',
    'https://fcm.googleapis.com:8443/fcm/send/example-token',
    'https://fcm.googleapis.com/fcm/send/example-token?redirect=https://attacker.test',
    'https://fcm.googleapis.com/fcm/send/example-token#fragment',
  ])('rejects unsupported or unsafe endpoint %s', (endpoint) => {
    expect(isApprovedPushEndpoint(endpoint)).toBe(false);
  });
});
