// ============================================================================
// Coach session service — framework-free core.
// ----------------------------------------------------------------------------
// The session logic (PIN check, HMAC tokens, rate-limit guard) lives here
// ONCE and is shared by two thin adapters:
//   - src/server/api.ts      → Express (Vercel serverless + local Node)
//   - cloudflare-worker.mjs  → Hono (Cloudflare Workers)
// Express itself cannot run inside a wrangler-bundled Worker: importing it
// pulls in body-parser → raw-body → iconv-lite, which crashes the bundle
// with "require_streams(...) is not a function" (workers-sdk #9309, #10022;
// still present in wrangler 4.166.0 — proven 2026-11-21 by a minimal repro
// importing only `express`). Hono is Workers-native with zero Node
// dependencies, so the Worker uses it while this service keeps ONE
// implementation of the security-critical behaviour. Response contracts are
// identical across runtimes; only the HTTP glue differs.
// ============================================================================

import crypto from 'crypto';
import { getServerRuntimeEnv } from './runtimeEnv.js';
import { brandCopy } from '../config/brand.js';
import {
  getCoachGuardStore,
  GuardUnavailableError,
} from './coachGuardStore.js';

export interface ServiceResult {
  status: number;
  body: unknown;
}

const isProd = (): boolean => getServerRuntimeEnv('NODE_ENV') === 'production';

// ============================================================================
// السر المستخدم لتوقيع جلسات الطبيبة (HMAC): لازم يكون فريد لكل عميل/نسخة
// ============================================================================
let devSessionSecret: string | null = null;
const getSessionSecret = (): string => {
  const secret = getServerRuntimeEnv('SESSION_SECRET');
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
  const pin = getServerRuntimeEnv('COACH_PIN');
  if (pin) return String(pin).trim();

  if (isProd()) {
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
function guardFailureBody(err: unknown): ServiceResult {
  if (err instanceof GuardUnavailableError) {
    return { status: 503, body: { ok: false, error: err.message } };
  }
  // Never log an exception object here: third-party errors may contain request metadata.
  console.error('coach-session error: unexpected internal failure');
  return { status: 500, body: { ok: false, error: 'خطأ داخلي في الخادم. حاول مرة أخرى.' } };
}

// فحص إعدادات الأمان عند بدء التشغيل.
// في الإنتاج يفشل فورًا (throw) لو SESSION_SECRET أو COACH_PIN غير معرفين — لا افتراضيات صامتة.
export const validateSecurityConfig = (): void => {
  if (isProd()) {
    const missing: string[] = [];
    if (!getServerRuntimeEnv('SESSION_SECRET')?.trim()) missing.push('SESSION_SECRET');
    if (!getServerRuntimeEnv('COACH_PIN')?.trim()) missing.push('COACH_PIN');
    if (missing.length > 0) {
      throw new Error(
        `متغيرات أمان ناقصة في بيئة الإنتاج: ${missing.join(', ')} — عرّفها في متغيرات البيئة قبل النشر.`
      );
    }
  }
  getSessionSecret();
  getCoachPin();
};

// Create Session — نفس منطق المعالج الأصلي، بلا اعتماد على Express.
export const createCoachSession = async (input: {
  ip: string;
  pin: unknown;
}): Promise<ServiceResult> => {
  const ip = input.ip;

  try {
    // SDV2-SEC-003: getCoachGuardStore() داخل الـ try حتى يُمسك
    // GuardUnavailableError بواسطة guardFailureBody ويُرجع 503 بدل انهيار غير مُعالج.
    const store = getCoachGuardStore();

    if (await store.isLockedOut(ip)) {
      return {
        status: 429,
        body: {
          ok: false,
          error: 'تم إيقاف المحاولات مؤقتًا بسبب محاولات دخول متكررة خاطئة. حاول مرة أخرى بعد بضع دقائق.',
        },
      };
    }

    const reqPin = String(input.pin || '').trim();
    const serverPin = String(getCoachPin()).trim();

    if (!reqPin || !pinsEqual(reqPin, serverPin)) {
      await store.recordFailedAttempt(ip);
      return {
        status: 403,
        body: {
          ok: false,
          error: brandCopy.pinWrong,
        },
      };
    }

    await store.clearAttempts(ip);
    const { token, expiresAt } = createSignedCoachToken();
    return {
      status: 200,
      body: {
        ok: true,
        token,
        expiresAt,
      },
    };
  } catch (err) {
    return guardFailureBody(err);
  }
};

// Delete Session — إبطال الرمز إن وُجد، ودائمًا 200 عند النجاح (كما كان).
export const deleteCoachSession = async (input: {
  token: unknown;
}): Promise<ServiceResult> => {
  const token = input.token as string | undefined;

  try {
    if (token) {
      await getCoachGuardStore().revokeToken(token, tokenExpiresAt(token));
    }
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return guardFailureBody(err);
  }
};
