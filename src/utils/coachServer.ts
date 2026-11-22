import { StorageKeys } from './storageKeys';
import { apiUrl } from './apiClient';

/**
 * جلسة الأخصائي عبر الخادم (POST /api/coach-session).
 * النموذج الموثق: أول دخول على جهاز جديد يكون عبر الخادم مقابل COACH_PIN،
 * ثم يُحفظ هاش محلي للفتح الأوفلاين. عند غياب خادم (استضافة ثابتة) ترجع
 * النتيجة unreachable فيتولى الفتح المحلي الأمر.
 */
export type CoachServerSessionResult =
  | { status: 'ok'; token: string; expiresAt: number }
  | { status: 'rejected'; error: string }
  | { status: 'locked'; error: string }
  | { status: 'unreachable' };

const REQUEST_TIMEOUT_MS = 5000;

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function createCoachServerSession(pin: string): Promise<CoachServerSessionResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(apiUrl('/api/coach-session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
  } catch {
    return { status: 'unreachable' };
  }

  if (res.ok) {
    try {
      const data = await res.json();
      if (data?.ok && typeof data.token === 'string') {
        return { status: 'ok', token: data.token, expiresAt: Number(data.expiresAt) || 0 };
      }
    } catch {
      // fallthrough
    }
    return { status: 'unreachable' };
  }
  if (res.status === 403) {
    let error = 'رمز PIN غير صحيح.';
    try {
      const data = await res.json();
      if (typeof data?.error === 'string' && data.error) error = data.error;
    } catch {
      // keep default
    }
    return { status: 'rejected', error };
  }
  if (res.status === 429) {
    return {
      status: 'locked',
      error: 'تم إيقاف المحاولات مؤقتًا على الخادم بسبب محاولات متكررة. حاول لاحقًا.',
    };
  }
  // 404/5xx: لا خادم فعليًا على هذا النشر (استضافة ثابتة) أو عطل — الفتح المحلي يتولى
  return { status: 'unreachable' };
}

export function saveCoachServerToken(token: string): void {
  try {
    localStorage.setItem(StorageKeys.coachSessionToken(), token);
  } catch {
    // ignore
  }
}

export function getCoachServerToken(): string | null {
  try {
    return localStorage.getItem(StorageKeys.coachSessionToken());
  } catch {
    return null;
  }
}

export function clearCoachServerToken(): void {
  try {
    localStorage.removeItem(StorageKeys.coachSessionToken());
  } catch {
    // ignore
  }
}

/** إلغاء الجلسة على الخادم (أفضل جهد — لا يمنع تسجيل الخروج المحلي) */
export async function deleteCoachServerSession(): Promise<void> {
  const token = getCoachServerToken();
  clearCoachServerToken();
  if (!token) return;
  try {
    await fetchWithTimeout(apiUrl('/api/coach-session'), {
      method: 'DELETE',
      headers: { 'x-coach-session': token },
    });
  } catch {
    // ignore — الإلغاء على الخادم ذاكري أصلًا
  }
}
