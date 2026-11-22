import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redis = new Map<string, string>();

const sharedRedisFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
  const command = JSON.parse(String(init?.body)) as Array<string>;
  const [operation, key, value] = command;
  let result: unknown = null;

  if (operation === 'GET') {
    result = redis.get(key) ?? null;
  } else if (operation === 'SET') {
    redis.set(key, value);
    result = 'OK';
  } else if (operation === 'DEL') {
    result = redis.delete(key) ? 1 : 0;
  } else {
    return new Response(JSON.stringify({ error: 'unsupported command' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

describe('Upstash guard state across independent service instances', () => {
  beforeEach(() => {
    vi.resetModules();
    redis.clear();
    sharedRedisFetch.mockClear();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'test-secret-for-unit-tests-0123456789');
    vi.stubEnv('COACH_PIN', '97531');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'dummy-test-token-only');
    vi.stubGlobal('fetch', sharedRedisFetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('continues the same per-IP lockout counter after loading a second service instance', async () => {
    const firstInstance = await import('../src/server/coachSessionService');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await firstInstance.createCoachSession({
        ip: '203.0.113.42',
        pin: '00000',
      });
      expect(result.status).toBe(403);
    }

    // Simulate a second independently loaded Node/Worker isolate. Only the
    // shared Redis-compatible store survives the module reload.
    vi.resetModules();
    const secondInstance = await import('../src/server/coachSessionService');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await secondInstance.createCoachSession({
        ip: '203.0.113.42',
        pin: '00000',
      });
      expect(result.status).toBe(403);
    }

    const locked = await secondInstance.createCoachSession({
      ip: '203.0.113.42',
      pin: '97531',
    });
    expect(locked.status).toBe(429);
    expect(redis.has('sd:coach:rl:203.0.113.42')).toBe(true);
    expect(sharedRedisFetch).toHaveBeenCalled();
  });
});
