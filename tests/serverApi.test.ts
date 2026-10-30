import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('server api — signed coach tokens', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SESSION_SECRET', 'test-secret-for-unit-tests-0123456789');
    vi.stubEnv('COACH_PIN', '97531');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a token that verifies', async () => {
    const { createSignedCoachToken, verifySignedCoachToken } = await import(
      '../src/server/api'
    );
    const { token } = createSignedCoachToken();
    expect(await verifySignedCoachToken(token)).toBe(true);
  });

  it('rejects tampered and malformed tokens', async () => {
    const { createSignedCoachToken, verifySignedCoachToken } = await import(
      '../src/server/api'
    );
    const { token } = createSignedCoachToken();
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(await verifySignedCoachToken(tampered)).toBe(false);
    expect(await verifySignedCoachToken('not-a-token')).toBe(false);
    expect(await verifySignedCoachToken('')).toBe(false);
  });

  it('a revoked token fails verification', async () => {
    const { createSignedCoachToken, verifySignedCoachToken } = await import(
      '../src/server/api'
    );
    const { getCoachGuardStore, __resetCoachGuardStore } = await import(
      '../src/server/coachGuardStore'
    );
    __resetCoachGuardStore();
    const store = getCoachGuardStore();
    const { token, expiresAt } = createSignedCoachToken();
    expect(await verifySignedCoachToken(token)).toBe(true);
    await store.revokeToken(token, expiresAt);
    expect(await verifySignedCoachToken(token)).toBe(false);
  });
});

describe('server api — production security config fails fast', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in production when COACH_PIN / SESSION_SECRET are missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');
    vi.stubEnv('COACH_PIN', '');
    const { validateSecurityConfig } = await import('../src/server/api');
    expect(() => validateSecurityConfig()).toThrow(/SESSION_SECRET/);
  });

  it('passes in production when both are set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'a-very-long-random-production-secret');
    vi.stubEnv('COACH_PIN', '97531');
    const { validateSecurityConfig } = await import('../src/server/api');
    expect(() => validateSecurityConfig()).not.toThrow();
  });
});

describe('server api — pin guard (memory store, no network)', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('SESSION_SECRET', 'test-secret-for-unit-tests-0123456789');
    vi.stubEnv('COACH_PIN', '97531');
    vi.stubEnv('NODE_ENV', 'test');
    // بلا Upstash: المخزن الافتراضي في الذاكرة
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const { __resetCoachGuardStore } = await import(
      '../src/server/coachGuardStore'
    );
    __resetCoachGuardStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockSession(pin: string, ip = '10.0.0.7') {
    const req = { ip, body: { pin }, socket: {} } as unknown as import('express').Request;
    let status = 200;
    let body: unknown = null;
    const res = {
      status: (s: number) => {
        status = s;
        return res;
      },
      json: (b: unknown) => {
        body = b;
        return res;
      },
    } as unknown as import('express').Response;
    return { req, res, get status() { return status; }, get body() { return body; } };
  }

  it('fifth failure locks the ip, success clears', async () => {
    const { handleCreateSession } = await import('../src/server/api');
    for (let i = 0; i < 5; i++) {
      const m = mockSession('00000');
      await handleCreateSession(m.req, m.res);
      expect(m.status).toBe(403);
    }
    const locked = mockSession('00000');
    await handleCreateSession(locked.req, locked.res);
    expect(locked.status).toBe(429);

    // نجاح من IP آخر ما زال يعمل، ونجاح الـ IP المقفل بعد انتهاء القفل يصفّر
    const { getCoachGuardStore } = await import('../src/server/coachGuardStore');
    const store = getCoachGuardStore();
    expect(await store.isLockedOut('10.0.0.7')).toBe(true);
    await store.clearAttempts('10.0.0.7');
    expect(await store.isLockedOut('10.0.0.7')).toBe(false);
    const ok = mockSession('97531');
    await handleCreateSession(ok.req, ok.res);
    expect((ok.body as { ok: boolean }).ok).toBe(true);
  });

  it('missing Upstash still issues a session outside production', async () => {
    const { handleCreateSession } = await import('../src/server/api');
    const m = mockSession('97531');
    await handleCreateSession(m.req, m.res);
    const body = m.body as { ok: boolean; token?: string; expiresAt?: number };
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(typeof body.expiresAt).toBe('number');
  });
});
