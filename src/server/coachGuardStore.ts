// ============================================================================
// مخزن حارس جلسة الطبيبة: حدّ محاولات الـ PIN وإبطال الرموز.
// ----------------------------------------------------------------------------
// - الافتراضي مخزن في الذاكرة (للاختبارات والتطوير المحلي، وللإنتاج عند
//   غياب Upstash) — بنفس سلوك الكود القديم: 5 محاولات ثم قفل 5 دقائق
//   يتضاعف حتى سقف 60 دقيقة.
// - المخزن الدائم عبر Upstash Redis REST (fetch فقط، بلا SDK) يُفعَّل فقط
//   عند وجود UPSTASH_REDIS_REST_URL وUPSTASH_REDIS_REST_TOKEN معًا.
//   ملاحظة صريحة: حدّ الذاكرة لا ينفع على Vercel (كل Lambda معزولة)،
//   فالإنتاج الحقيقي يحتاج المتغيرين.
// - لا يُخزَّن الرمز الخام أبدًا — مفتاح الإبطال = SHA-256 للرمز.
// ============================================================================

import crypto from 'crypto';

export const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;

const RL_PREFIX = 'sd:coach:rl:';
const REV_PREFIX = 'sd:coach:rev:';

// يُرمى عند فشل الوصول للمخزن الدائم — المعالج يرد 503 عربي واضح.
export class GuardUnavailableError extends Error {
  constructor(message = 'تعذر الوصول إلى مخزن الحماية. حاول مرة أخرى بعد قليل.') {
    super(message);
    this.name = 'GuardUnavailableError';
  }
}

export interface CoachGuardStore {
  recordFailedAttempt(ip: string): Promise<void>;
  isLockedOut(ip: string): Promise<boolean>;
  clearAttempts(ip: string): Promise<void>;
  revokeToken(token: string, expiresAt: number): Promise<void>;
  isRevoked(token: string): Promise<boolean>;
}

interface AttemptEntry {
  count: number;
  lockedUntil: number;
  lockouts: number;
}

function lockoutDuration(lockouts: number): number {
  return Math.min(LOCKOUT_MS * 2 ** lockouts, MAX_LOCKOUT_MS);
}

function applyFailedAttempt(entry: AttemptEntry): AttemptEntry {
  const next = { ...entry, count: entry.count + 1 };
  if (next.count >= MAX_ATTEMPTS) {
    next.lockedUntil = Date.now() + lockoutDuration(next.lockouts);
    next.lockouts += 1;
    next.count = 0;
  }
  return next;
}

function lockActive(entry: AttemptEntry | null | undefined): boolean {
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  return false;
}

// --- مخزن الذاكرة: الافتراضي -------------------------------------------------
export class MemoryCoachGuardStore implements CoachGuardStore {
  private attempts = new Map<string, AttemptEntry>();
  private revoked = new Map<string, number>();

  async recordFailedAttempt(ip: string): Promise<void> {
    const current = this.attempts.get(ip) || { count: 0, lockedUntil: 0, lockouts: 0 };
    this.attempts.set(ip, applyFailedAttempt(current));
  }

  async isLockedOut(ip: string): Promise<boolean> {
    const entry = this.attempts.get(ip);
    if (lockActive(entry)) return true;
    // انتهى القفل: صفّر العدّاد بدل تركه معلقًا
    if (entry && entry.lockedUntil && entry.lockedUntil <= Date.now()) {
      entry.lockedUntil = 0;
      entry.count = 0;
    }
    return false;
  }

  async clearAttempts(ip: string): Promise<void> {
    this.attempts.delete(ip);
  }

  async revokeToken(token: string, expiresAt: number): Promise<void> {
    this.revoked.set(token, expiresAt);
  }

  async isRevoked(token: string): Promise<boolean> {
    const exp = this.revoked.get(token);
    if (exp == null) return false;
    if (exp <= Date.now()) {
      this.revoked.delete(token);
      return false;
    }
    return true;
  }
}

// --- مخزن Upstash عبر REST (fetch فقط) ----------------------------------------
class UpstashCoachGuardStore implements CoachGuardStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async cmd(...args: Array<string | number>): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
    } catch {
      throw new GuardUnavailableError();
    }
    let data: { result?: unknown; error?: string };
    try {
      data = (await res.json()) as { result?: unknown; error?: string };
    } catch {
      throw new GuardUnavailableError();
    }
    if (!res.ok || data.error) throw new GuardUnavailableError();
    return data.result;
  }

  private rlKey(ip: string): string {
    return `${RL_PREFIX}${ip}`;
  }

  private revKey(token: string): string {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return `${REV_PREFIX}${hash}`;
  }

  async recordFailedAttempt(ip: string): Promise<void> {
    const raw = (await this.cmd('GET', this.rlKey(ip))) as string | null;
    let entry: AttemptEntry = { count: 0, lockedUntil: 0, lockouts: 0 };
    if (raw) {
      try {
        entry = JSON.parse(raw) as AttemptEntry;
      } catch {
        entry = { count: 0, lockedUntil: 0, lockouts: 0 };
      }
    }
    const next = applyFailedAttempt(entry);
    // TTL يغطي أطول قفل ممكن (60 دقيقة) مع هامش
    await this.cmd('SET', this.rlKey(ip), JSON.stringify(next), 'EX', 3900);
  }

  async isLockedOut(ip: string): Promise<boolean> {
    const raw = (await this.cmd('GET', this.rlKey(ip))) as string | null;
    if (!raw) return false;
    try {
      return lockActive(JSON.parse(raw) as AttemptEntry);
    } catch {
      return false;
    }
  }

  async clearAttempts(ip: string): Promise<void> {
    await this.cmd('DEL', this.rlKey(ip));
  }

  async revokeToken(token: string, expiresAt: number): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
    await this.cmd('SET', this.revKey(token), '1', 'EX', ttlSec);
  }

  async isRevoked(token: string): Promise<boolean> {
    const raw = await this.cmd('GET', this.revKey(token));
    return raw != null;
  }
}

// --- الاختيار -----------------------------------------------------------------
let store: CoachGuardStore | null = null;

export function getCoachGuardStore(): CoachGuardStore {
  if (store) return store;
  const url = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (url && token) {
    store = new UpstashCoachGuardStore(url, token);
  } else if (process.env.NODE_ENV === 'production') {
    // SDV2-SEC-003: الفشل المغلق في الإنتاج — لا نعود للذاكرة بصمت.
    // حدّ الذاكرة لا يعمل عبر نسخ Vercel المتعددة، فالسماح به يعطل الحماية.
    throw new GuardUnavailableError(
      'مخزن الحماية غير مهيأ في الإنتاج. اضبط UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN.',
    );
  } else {
    store = new MemoryCoachGuardStore();
  }
  return store;
}

// للاختبارات فقط: إعادة الاختيار من متغيرات البيئة
export function __resetCoachGuardStore(): void {
  store = null;
}
