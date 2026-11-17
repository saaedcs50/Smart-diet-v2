// Web Push registration and delivery through the platform's Supabase Edge Function.
import { getSupabase } from './supabase';

function readEnv(name: string): string | undefined {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.[name];
  if (metaEnv !== undefined) return metaEnv;
  return (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];
}

function decodeVapidKey(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const key = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (key.length !== 65 || key[0] !== 4) throw new Error('مفتاح الإشعارات غير صالح.');
  return key;
}

export function isPushDeliveryEnabled(): boolean {
  const publicKey = readEnv('VITE_VAPID_PUBLIC_KEY');
  if (!publicKey || !readEnv('VITE_SUPABASE_URL') || !readEnv('VITE_SUPABASE_ANON_KEY')) return false;
  try {
    decodeVapidKey(publicKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers the current browser endpoint for the signed-in patient.
 * Permission is requested only from an explicit patient button click.
 */
export async function registerPushSubscription(patientUid: string): Promise<string | null> {
  try {
    if (!isPushDeliveryEnabled()) return null;
    if (typeof navigator === 'undefined' || typeof window === 'undefined' ||
        typeof Notification === 'undefined') return null;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    // Ask before any network await so the browser's user-activation requirement is preserved.
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const sb = getSupabase();
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError || !user || user.id !== patientUid) return null;

    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = decodeVapidKey(readEnv('VITE_VAPID_PUBLIC_KEY')!);
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const currentApplicationServerKey = subscription.options.applicationServerKey;
      const currentKey = currentApplicationServerKey
        ? new Uint8Array(currentApplicationServerKey)
        : null;
      const sameKey = currentKey !== null &&
        currentKey.length === applicationServerKey.length &&
        currentKey.every((value, index) => value === applicationServerKey[index]);
      if (!sameKey) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    const endpoint = subscription.endpoint;
    if (!endpoint || !endpoint.startsWith('https://') || endpoint.length > 2048) return null;

    const { error } = await sb.rpc('claim_push_subscription', { p_endpoint: endpoint });
    if (error) throw new Error(error.message);
    return endpoint;
  } catch {
    return null;
  }
}

/** Sends a non-clinical, empty-payload notification to a patient's devices. */
export async function notifyPatient(
  patientUid: string,
  accessToken: string,
): Promise<{ ok: boolean; sent: number }> {
  if (!isPushDeliveryEnabled()) throw new Error('إعدادات إشعارات العيادة غير مكتملة.');
  const baseUrl = readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  if (!baseUrl || !anonKey) throw new Error('إعدادات خدمة البيانات غير مكتملة.');

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ patientUid }),
  });
  const payload = await response.json().catch(() => ({})) as {
    ok?: boolean;
    sent?: number;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || 'فشل إرسال التنبيه.');
  return { ok: payload.ok === true, sent: Number(payload.sent ?? 0) };
}
