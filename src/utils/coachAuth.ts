import { StorageKeys, brandStorageSlug } from './storageKeys';

// لا توجد أي رموز PIN افتراضية أو مدمجة في الكود.
// أول استخدام: يُنشأ الرمز محليًا (إعداد أول مرة) أو يُتحقق منه عبر الخادم، ويُخزَّن هاشه المُملَّح فقط.
export const MIN_PIN_LENGTH = 4; // حد القبول الأدنى عند التخزين (توافقًا مع رموز خادم قائمة)
export const MIN_NEW_PIN_LENGTH = 5; // حد إنشاء رمز محلي جديد

// علَم بناء واحد: الوضع المحلي الخالص (استضافة ثابتة بلا API) يُفعَّل فقط
// عندما تكون القيمة حرفيًا 'true'. بدونه لا يُنشأ رمز محلي عند تعذّر
// الوصول للخادم — يجب التحقق من الخادم أولًا.
// قراءة علَم البناء بنفس نمط platformMode.ts (import.meta أولًا ثم process)
function readBuildFlag(name: string): string | undefined {
  const metaEnv = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env?.[name];
  if (metaEnv !== undefined) return metaEnv;
  return (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];
}

export const COACH_LOCAL_ONLY = (() => {
  // SDV2-SEC-002: الوضع المحلي الخالص مسموح فقط في وضع التطوير الصريح.
  // في الإنتاج/المعاينة يجب الفشل المغلق عند تعذر الوصول للخادم —
  // لا يُنشأ رمز محلي لزائر جديد لمجرد تعذر الـ API.
  const flag = readBuildFlag('VITE_COACH_LOCAL_ONLY') === 'true';
  if (!flag) return false;
  try {
    const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
    return isDev;
  } catch {
    return false;
  }
})();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const HASH_V2_PREFIX = 'v2$';

function unlockKey() {
  return StorageKeys.coachUnlocked();
}

function pinHashKey() {
  return StorageKeys.coachPinHash();
}

function pinSaltKey() {
  return StorageKeys.coachPinSalt();
}

function rateLimitKey() {
  return `sd_${brandStorageSlug()}_coach_rate_limit`;
}

interface RateLimitState {
  attempts: number;
  lockedUntil: number;
}

function getRateLimitState(): RateLimitState {
  try {
    const raw = localStorage.getItem(rateLimitKey());
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0,
    };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function saveRateLimitState(state: RateLimitState): void {
  try {
    localStorage.setItem(rateLimitKey(), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getLockoutRemainingSeconds(): number {
  const state = getRateLimitState();
  if (state.lockedUntil > Date.now()) {
    return Math.ceil((state.lockedUntil - Date.now()) / 1000);
  }
  return 0;
}

export function isCoachLockedOut(): boolean {
  return getLockoutRemainingSeconds() > 0;
}

export function getRemainingAttempts(): number {
  const state = getRateLimitState();
  if (isCoachLockedOut()) return 0;
  return Math.max(0, MAX_ATTEMPTS - state.attempts);
}

const PROOF_VERSION = 1;
const PROOF_TTL_MS = 60 * 60 * 1000; // الجلسة المحلية 60 دقيقة كحد أقصى

interface UnlockProof {
  v: number;
  exp: number;
  tag: string;
  bound: string;
}

function randomTagHex(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

/**
 * تعليم الجلسة كمفتوحة بدليل منظم: نسخة + انتهاء (≤ 60 دقيقة) + وسم عشوائي
 * مربوط بهاش الـ PIN المخزَّن عبر hashesEqual (تغيير الرمز يُبطل الدليل القديم).
 * ملاحظة صريحة: من يستطيع قراءة هاش الـ PIN من التخزين المحلي يستطيع تزوير
 * هذا الدليل — ليس سر خادم ولا حدًا أمنيًا ضد مالك المتصفح.
 * (يستخدمه مسار الخادم بعد تحقق ناجح، والفتح المحلي بعد تحقق الهاش)
 */
export function markCoachSessionUnlocked(): void {
  try {
    const storedHash = localStorage.getItem(pinHashKey());
    if (!storedHash) return;
    const proof: UnlockProof = {
      v: PROOF_VERSION,
      exp: Date.now() + PROOF_TTL_MS,
      tag: randomTagHex(),
      bound: storedHash,
    };
    sessionStorage.setItem(unlockKey(), JSON.stringify(proof));
  } catch {
    // ignore
  }
}

export function isCoachSessionUnlocked(): boolean {
  try {
    const raw = sessionStorage.getItem(unlockKey());
    if (!raw) return false;
    // القيمة الحرفية 'true' القديمة لم تعد نجاحًا
    if (raw === 'true') return false;
    const proof = JSON.parse(raw) as Partial<UnlockProof>;
    if (proof.v !== PROOF_VERSION) return false;
    if (typeof proof.exp !== 'number' || proof.exp <= Date.now()) return false;
    if (typeof proof.tag !== 'string' || !proof.tag) return false;
    if (typeof proof.bound !== 'string' || !proof.bound) return false;
    const storedHash = localStorage.getItem(pinHashKey());
    if (!storedHash) return false;
    return hashesEqual(proof.bound, storedHash);
  } catch {
    return false;
  }
}

export type CoachUnlockResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      remainingAttempts?: number;
      lockedSeconds?: number;
      /** لا يوجد PIN مُعدّ بعد على هذا الجهاز — يلزم إعداد أول مرة */
      needsSetup?: boolean;
    };

// لا يوجد بديل ضعيف: غياب crypto.subtle خطأ واضح ولا يُكتب شيء
async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('التشفير (crypto.subtle) غير متاح في هذا المتصفح — لا يمكن التحقق من الرمز أو حفظه.');
  }
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function pinHashPayload(pin: string): string {
  return `clinidiet:${brandStorageSlug()}:local-pin:${pin.trim()}`;
}

function randomSaltHex(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

/** هاش v2: SHA-256 للملح + الحمولة، بصيغة v2$<hash> والملح مخزَّن في مفتاح منفصل */
async function saltedPinHash(pin: string, salt: string): Promise<string> {
  return HASH_V2_PREFIX + (await sha256Hex(`${salt}:${pinHashPayload(pin)}`));
}

async function storePinHash(pin: string): Promise<void> {
  const salt = randomSaltHex();
  const hash = await saltedPinHash(pin, salt);
  localStorage.setItem(pinSaltKey(), salt);
  localStorage.setItem(pinHashKey(), hash);
}

/** مقارنة ثابتة الزمن تقريبًا لنصوص الهاش */
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** هل عُيِّن رمز PIN على هذا الجهاز من قبل؟ */
export function hasCoachPin(): boolean {
  try {
    return !!localStorage.getItem(pinHashKey());
  } catch {
    return false;
  }
}

/**
 * إعداد أول مرة: إنشاء رمز PIN جديد — متاح فقط عندما لا يوجد رمز مُعدّ بعد.
 * لا يوجد أي رمز افتراضي يمكن الدخول به قبل هذا الإعداد.
 */
export async function setupCoachPin(
  newPin: string,
  confirmPin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pin = String(newPin || '').trim();
  const confirm = String(confirmPin || '').trim();
  if (hasCoachPin()) {
    return { ok: false, error: 'يوجد رمز PIN مُعدّ بالفعل على هذا الجهاز.' };
  }
  if (pin.length < MIN_NEW_PIN_LENGTH) {
    return { ok: false, error: `يجب أن يتكون رمز PIN من ${MIN_NEW_PIN_LENGTH} أرقام على الأقل.` };
  }
  if (!/^\d+$/.test(pin)) {
    return { ok: false, error: 'يجب أن يتكون رمز PIN من أرقام فقط.' };
  }
  if (pin !== confirm) {
    return { ok: false, error: 'الرمزان غير متطابقين. أعد الإدخال.' };
  }
  try {
    await storePinHash(pin);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : 'تعذّر حفظ الرمز. حاول مرة أخرى.',
    };
  }
}

/** تغيير رمز PIN من داخل لوحة الأخصائي (بعد الدخول) — يُخزَّن دائمًا بهاش مُملَّح v2 */
export async function setCoachCustomPin(newPin: string): Promise<boolean> {
  const trimmed = String(newPin || '').trim();
  if (!trimmed || trimmed.length < MIN_PIN_LENGTH) return false;
  try {
    await storePinHash(trimmed);
    return true;
  } catch {
    return false;
  }
}

async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(pinHashKey());
  if (!stored) return false;
  if (stored.startsWith(HASH_V2_PREFIX)) {
    const salt = localStorage.getItem(pinSaltKey()) || '';
    const candidate = await saltedPinHash(pin, salt);
    return hashesEqual(stored, candidate);
  }
  // هاش قديم (v1، بلا ملح — من إصدارات سابقة): تحقق ثم رقِّ التخزين إلى v2 عند النجاح
  const legacy = await sha256Hex(pinHashPayload(pin));
  if (hashesEqual(stored, legacy)) {
    try {
      await storePinHash(pin);
    } catch {
      // الترقية اختيارية — لا تمنع الدخول
    }
    return true;
  }
  return false;
}

/**
 * يتحقق من صحة رمز الـ PIN محليًا بالكامل بدون أي اتصال بالإنترنت أو الخادم
 * مع تطبيق Rate Limiting محلي (5 محاولات كحد أقصى ثم قفل لمدة 5 دقائق).
 * لا توجد رموز افتراضية: بدون إعداد أول مرة لا يمكن الدخول.
 */
export async function unlockCoachSession(pin: string): Promise<CoachUnlockResult> {
  const trimmed = String(pin || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'يرجى إدخال رمز PIN للدخول.' };
  }

  if (!hasCoachPin()) {
    return {
      ok: false,
      needsSetup: true,
      error: 'لم يتم تعيين رمز PIN بعد على هذا الجهاز. أنشئ رمزك أولًا من شاشة الإعداد.',
    };
  }

  // 1. فحص الـ Rate Limiting
  const remainingLockout = getLockoutRemainingSeconds();
  if (remainingLockout > 0) {
    const mins = Math.floor(remainingLockout / 60);
    const secs = remainingLockout % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return {
      ok: false,
      error: `تم إيقاف المحاولات مؤقتًا بسبب تكرار المحاولات الخاطئة. يرجى الانتظار (${timeFormatted}).`,
      lockedSeconds: remainingLockout,
      remainingAttempts: 0,
    };
  }

  // 2. التحقق من الهاش المخزَّن فقط (v2 مُملَّح، أو v1 قديم يُرقّى عند النجاح)
  // غياب crypto.subtle يفشل برسالة واضحة ولا يكتب شيئًا
  let isCorrect: boolean;
  try {
    isCorrect = await verifyPin(trimmed);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : 'تعذّر التحقق من الرمز.',
    };
  }

  // 3. في حالة النجاح
  if (isCorrect) {
    // تصفير عداد المحاولات الخاطئة
    saveRateLimitState({ attempts: 0, lockedUntil: 0 });
    markCoachSessionUnlocked();
    return { ok: true };
  }

  // 4. في حالة الخطأ -> زيادة عداد المحاولات
  const state = getRateLimitState();
  const nextAttempts = state.attempts + 1;

  if (nextAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    saveRateLimitState({ attempts: 0, lockedUntil });
    return {
      ok: false,
      error: 'تم تجاوز الحد الأقصى للمحاولات (5 محاولات). تم قفل الدخول مؤقتًا لمدة 5 دقائق لحماية البيانات.',
      remainingAttempts: 0,
      lockedSeconds: 300,
    };
  } else {
    saveRateLimitState({ attempts: nextAttempts, lockedUntil: 0 });
    const remaining = MAX_ATTEMPTS - nextAttempts;
    return {
      ok: false,
      error: `رمز PIN غير صحيح. متبقي ${remaining} ${remaining === 1 ? 'محاولة واحدة' : 'محاولات'} قبل القفل المؤقت.`,
      remainingAttempts: remaining,
    };
  }
}

export function logoutCoachSession(): void {
  try {
    sessionStorage.removeItem(unlockKey());
  } catch {
    // ignore
  }
}
