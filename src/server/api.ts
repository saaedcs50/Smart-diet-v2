import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { brandCopy } from '../config/brand';
import {
  getCoachGuardStore,
  GuardUnavailableError,
} from './coachGuardStore';

export const apiRouter = Router();

// Ensure body parser is applied to all api routes
apiRouter.use(express.json({ limit: '200kb' }));

const isProd = process.env.NODE_ENV === 'production';

// ============================================================================
// السر المستخدم لتوقيع جلسات الطبيبة (HMAC): لازم يكون فريد لكل عميل/نسخة
// ============================================================================
let devSessionSecret: string | null = null;
const getSessionSecret = (): string => {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret.trim();

  if (!devSessionSecret) {
    devSessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      'SESSION_SECRET غير معرف: تم توليد سر مؤقت. حدد SESSION_SECRET في ملف .env للإنتاج.'
    );
  }
  return devSessionSecret;
};

// ============================================================================
// رمز PIN الخاص بالطبيبة/الأخصائية
// في الإنتاج: غياب COACH_PIN خطأ قاتل عند الإقلاع (انظر validateSecurityConfig).
// الافتراضي 12345 مسموح في التطوير المحلي فقط لتجربة الواجهة.
// ============================================================================
let devCoachPin: string | null = null;
const getCoachPin = (): string => {
  const pin = process.env.COACH_PIN;
  if (pin) return String(pin).trim();

  if (isProd) {
    throw new Error('COACH_PIN غير معرف في بيئة الإنتاج — أضفه في متغيرات البيئة قبل النشر.');
  }
  if (!devCoachPin) {
    devCoachPin = '12345';
    console.warn(
      `COACH_PIN غير معرف: استخدام الرمز الافتراضي (12345) — تطوير محلي فقط. حدد COACH_PIN في ملف .env قبل النشر.`
    );
  }
  return devCoachPin;
};

/** مقارنة ثابتة الزمن: نهشّ الطرفين ثم نقارن بـ timingSafeEqual */
const pinsEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Generate a cryptographically signed HMAC token (Stateless & Vercel-compatible)
export function createSignedCoachToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 60 * 60 * 1000; // 60 minutes
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${expiresAt}.${nonce}`;
  const hmac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  const token = `${payload}.${hmac}`;
  return { token, expiresAt };
}

// Verify HMAC signed token (async: revocation lives in the guard store)
export async function verifySignedCoachToken(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  if (await getCoachGuardStore().isRevoked(token)) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresAtStr, nonce, hmac] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt < Date.now()) return false;

  const payload = `${expiresAtStr}.${nonce}`;
  const expectedHmac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');

  try {
    const hmacBuf = Buffer.from(hmac, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    if (hmacBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(hmacBuf, expectedBuf);
  } catch {
    return false;
  }
}

// استخراج انتهاء الرمز من حمولته لحساب TTL الإبطال
function tokenExpiresAt(token: string): number {
  const first = token.split('.')[0];
  const parsed = parseInt(first, 10);
  if (!first || isNaN(parsed) || parsed <= Date.now()) {
    return Date.now() + 60 * 60 * 1000;
  }
  return parsed;
}

// رد موحد لأخطاء المعالج: فشل المخزن الدائم = 503 عربي واضح، لا 500 فارغ
function guardFailure(res: Response, err: unknown): Response {
  if (err instanceof GuardUnavailableError) {
    return res.status(503).json({ ok: false, error: err.message });
  }
  console.error('coach-session error', err);
  return res.status(500).json({ ok: false, error: 'خطأ داخلي في الخادم. حاول مرة أخرى.' });
}

// فحص إعدادات الأمان عند بدء التشغيل.
// في الإنتاج يفشل فورًا (throw) لو SESSION_SECRET أو COACH_PIN غير معرفين — لا افتراضيات صامتة.
export const validateSecurityConfig = (): void => {
  if (isProd) {
    const missing: string[] = [];
    if (!process.env.SESSION_SECRET?.trim()) missing.push('SESSION_SECRET');
    if (!process.env.COACH_PIN?.trim()) missing.push('COACH_PIN');
    if (missing.length > 0) {
      throw new Error(
        `متغيرات أمان ناقصة في بيئة الإنتاج: ${missing.join(', ')} — عرّفها في متغيرات البيئة قبل النشر.`
      );
    }
  }
  getSessionSecret();
  getCoachPin();
};

// 1. Health Check
const handleHealth = (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
};

// 2. Create Session (مُصدَّر للاختبارات)
export const handleCreateSession = async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    // SDV2-SEC-003: getCoachGuardStore() داخل الـ try حتى يُمسك
    // GuardUnavailableError بواسطة guardFailure ويُرجع 503 بدل انهيار غير مُعالج.
    const store = getCoachGuardStore();

    if (await store.isLockedOut(ip)) {
      return res.status(429).json({
        ok: false,
        error: 'تم إيقاف المحاولات مؤقتًا بسبب محاولات دخول متكررة خاطئة. حاول مرة أخرى بعد بضع دقائق.',
      });
    }

    const reqPin = String(req.body?.pin || '').trim();
    const serverPin = String(getCoachPin()).trim();

    if (!reqPin || !pinsEqual(reqPin, serverPin)) {
      await store.recordFailedAttempt(ip);
      return res.status(403).json({
        ok: false,
        error: brandCopy.pinWrong,
      });
    }

    await store.clearAttempts(ip);
    const { token, expiresAt } = createSignedCoachToken();
    return res.json({
      ok: true,
      token,
      expiresAt,
    });
  } catch (err) {
    return guardFailure(res, err);
  }
};

// 3. Delete Session
const handleDeleteSession = async (req: Request, res: Response) => {
  const headerToken = req.headers['x-coach-session'] as string;
  const bodyToken = req.body?.token as string;
  const token = headerToken || bodyToken;

  try {
    if (token) {
      await getCoachGuardStore().revokeToken(token, tokenExpiresAt(token));
    }
    return res.json({ ok: true });
  } catch (err) {
    return guardFailure(res, err);
  }
};

// Register routes both with and without /api prefix to support all proxy/rewrite configurations
apiRouter.get('/health', handleHealth);
apiRouter.get('/api/health', handleHealth);

apiRouter.post('/coach-session', handleCreateSession);
apiRouter.post('/api/coach-session', handleCreateSession);

apiRouter.delete('/coach-session', handleDeleteSession);
apiRouter.delete('/api/coach-session', handleDeleteSession);
