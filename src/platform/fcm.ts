// ============================================================================
// FCM — تسجيل توكن الجهاز للمريض (المرحلة السادسة من B2B)
// ----------------------------------------------------------------------------
// - يطلب إذن الإشعارات ويسجل توكن FCM في جدول fcm_tokens
// - مفتاح VAPID من VITE_FCM_VAPID_KEY
// - إرسال الإشعار نفسه يتم عبر Edge Function (POST /notify) — لا إرسال من العميل
// - ترحيل 2026-10-31: Firestore ← Supabase (fcm_tokens)
// ============================================================================

import { getSupabase } from './supabase';

const VAPID_KEY = (() => {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.VITE_FCM_VAPID_KEY;
  if (metaEnv !== undefined) return metaEnv;
  return (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.VITE_FCM_VAPID_KEY;
})();

export function isFcmConfigured(): boolean {
  return !!VAPID_KEY;
}

/**
 * تسجيل توكن الجهاز للمريض. يُستدعى بعد تسجيل الدخول (للمريض فقط).
 * يعيد التوكن أو null إذا تعذّر.
 * يستخدم Web Push API الأصلي (بلا Firebase Messaging).
 */
export async function registerFcmToken(patientUid: string): Promise<string | null> {
  try {
    if (!VAPID_KEY) return null;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.ready;
    // مفتاح VAPID بصيغة base64url ← Uint8Array
    const vapidBytes = Uint8Array.from(
      atob(VAPID_KEY.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidBytes.buffer as ArrayBuffer,
    });
    // تخزين الاشتراك الكامل (endpoint + keys) — الإرسال يحتاج المفاتيح وليس الرابط فقط
    const subJson = subscription.toJSON();
    if (!subJson.endpoint) return null;
    const token = JSON.stringify(subJson);

    // حفظ التوكن (دمج مع الموجودة بلا تكرار)
    const sb = getSupabase();
    const { data } = await sb
      .from('fcm_tokens')
      .select('tokens')
      .eq('patient_id', patientUid)
      .single();
    const existing: string[] = data
      ? ((data as { tokens: string[] }).tokens ?? [])
      : [];
    if (!existing.includes(token)) {
      const { error } = await sb.from('fcm_tokens').upsert(
        {
          patient_id: patientUid,
          tokens: [...existing, token],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'patient_id' },
      );
      if (error) throw new Error(error.message);
    }
    return token;
  } catch {
    return null;
  }
}

/** استقبال إشعار أثناء فتح التطبيق (foreground) — عبر Service Worker. */
export function onForegroundMessage(
  cb: (payload: { title?: string; body?: string }) => void,
): (() => void) | null {
  if (!('serviceWorker' in navigator)) return null;
  const handler = (event: MessageEvent) => {
    const data = event.data as { title?: string; body?: string } | undefined;
    if (data && (data.title || data.body)) cb(data);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

const FUNCTIONS_URL = (() => {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.VITE_SUPABASE_URL;
  const base =
    metaEnv !== undefined
      ? metaEnv
      : (
          globalThis as unknown as {
            process?: { env?: Record<string, string | undefined> };
          }
        ).process?.env?.VITE_SUPABASE_URL;
  return base ? `${base}/functions/v1/notify` : undefined;
})();

/**
 * إشعار المريض من الدكتور عبر Edge Function.
 * يتطلب access token للمتصل (يُمرر في Authorization).
 */
export async function notifyPatient(
  patientUid: string,
  title: string,
  body: string,
  idToken: string,
): Promise<{ ok: boolean; sent: number }> {
  if (!FUNCTIONS_URL) throw new Error('رابط Edge Function غير مضبوط');
  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ patientUid, title, body }),
  });
  if (!res.ok) throw new Error('فشل إرسال الإشعار');
  return (await res.json()) as { ok: boolean; sent: number };
}
