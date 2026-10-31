// ============================================================================
// FCM — تسجيل توكن الجهاز للمريض (المرحلة السادسة من B2B)
// ----------------------------------------------------------------------------
// - يطلب إذن الإشعارات ويسجل توكن FCM في
//   patients/{uid}/notificationSettings/fcmTokens {tokens: [...]}
// - مفتاح VAPID من VITE_FCM_VAPID_KEY (يُضبط لاحقًا من Firebase Console)
// - إرسال الإشعار نفسه يتم عبر الـ Worker (POST /notify) — لا إرسال من العميل
// ============================================================================

import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseMessaging } from './firebase';
import { getFirestoreDb } from './firebase';

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
  return !!VAPID_KEY && !!getFirebaseMessaging();
}

/**
 * تسجيل توكن الجهاز للمريض. يُستدعى بعد تسجيل الدخول (للمريض فقط).
 * يعيد التوكن أو null إذا تعذّر.
 */
export async function registerFcmToken(patientUid: string): Promise<string | null> {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging || !VAPID_KEY) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return null;

    // حفظ التوكن (دمج مع الموجودة بلا تكرار)
    const db = getFirestoreDb();
    const ref = doc(db, 'patients', patientUid, 'notificationSettings', 'fcmTokens');
    const snap = await getDoc(ref);
    const existing = snap.exists()
      ? ((snap.data().tokens as string[] | undefined) ?? [])
      : [];
    if (!existing.includes(token)) {
      await setDoc(
        ref,
        { tokens: [...existing, token], updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    return token;
  } catch {
    return null;
  }
}

/** استقبال إشعار أثناء فتح التطبيق (foreground). */
export function onForegroundMessage(
  cb: (payload: MessagePayload) => void,
): (() => void) | null {
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;
  return onMessage(messaging, cb);
}

const WORKER_URL = (() => {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.VITE_FCM_WORKER_URL;
  if (metaEnv !== undefined) return metaEnv;
  return (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.VITE_FCM_WORKER_URL;
})();

/**
 * إشعار المريض من الدكتور عبر الـ Worker.
 * يتطلب ID token للمتصل (يُمرر في Authorization).
 */
export async function notifyPatient(
  patientUid: string,
  title: string,
  body: string,
  idToken: string,
): Promise<{ ok: boolean; sent: number }> {
  if (!WORKER_URL) throw new Error('رابط الـ Worker غير مضبوط');
  const res = await fetch(`${WORKER_URL}/notify`, {
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
