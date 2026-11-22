// Tests for the Cloudflare Worker (Hono) adapter — cloudflare-worker.mjs.
// The Worker module has no Worker-only imports (no cloudflare:node, no
// node:http), so vitest can import it directly with a fake env.
// Secrets here are DUMMY test values only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TEST_SECRET = 'test-secret-for-unit-tests-0123456789';
const TEST_PIN = '97531';

const ASSETS = {
  fetch: async () => new Response('asset', { status: 200 }),
};

const TEST_ENV = {
  NODE_ENV: 'test',
  SESSION_SECRET: TEST_SECRET,
  COACH_PIN: TEST_PIN,
  ASSETS,
};

const PROD_ENV_NO_SECRETS = {
  // NODE_ENV intentionally absent: the Worker must default to production
  // (fail-closed) when the binding is not set.
  ASSETS,
};

describe('cloudflare worker — hono api', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../cloudflare-worker.mjs');
    worker = mod.default;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function call(path: string, init?: RequestInit, env: any = TEST_ENV) {
    const req = new Request(`https://preview.test${path}`, init);
    const res = await worker.fetch(req, env);
    return res;
  }

  async function postPin(pin: string, ip = '10.0.0.7') {
    return call('/api/coach-session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': ip,
      },
      body: JSON.stringify({ pin }),
    });
  }

  it('health answers 200 without any secrets configured', async () => {
    for (const path of ['/health', '/api/health']) {
      const res = await call(path, undefined, PROD_ENV_NO_SECRETS);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok' });
    }
  });

  it('allows API preflight only from the configured frontend origin', async () => {
    const allowed = await call('/api/coach-session', {
      method: 'OPTIONS',
      headers: { Origin: 'https://frontend.example.test' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://frontend.example.test');
    expect(allowed.headers.get('access-control-allow-headers')).toBe('content-type, x-coach-session');

    const denied = await call('/api/coach-session', {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example.test' },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('non-api paths are served from Static Assets', async () => {
    const res = await call('/platform');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('asset');
  });

  it('coach-session fails closed (503) in production without secrets', async () => {
    const res = await postPin(TEST_PIN);
    // postPin uses TEST_ENV by default — re-call with the no-secrets env:
    const res2 = await call(
      '/api/coach-session',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: TEST_PIN }),
      },
      PROD_ENV_NO_SECRETS
    );
    expect(res.status).toBe(200); // sanity: test env works
    expect(res2.status).toBe(503);
    const body = (await res2.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('correct PIN issues a token; delete revokes it (same contract as Express)', async () => {
    const res = await postPin(TEST_PIN);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      token: string;
      expiresAt: number;
    };
    expect(body.ok).toBe(true);
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.expiresAt).toBeGreaterThan(Date.now());

    const del = await call('/api/coach-session', {
      method: 'DELETE',
      headers: { 'x-coach-session': body.token },
    });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
  });

  it('delete without a token still answers 200 (Express behaviour)', async () => {
    const res = await call('/api/coach-session', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('fifth failure still 403, sixth locks the ip (429)', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postPin('00000');
      expect(res.status).toBe(403);
    }
    const locked = await postPin('00000');
    expect(locked.status).toBe(429);

    // Another IP is unaffected.
    const other = await postPin(TEST_PIN, '10.0.0.9');
    expect(other.status).toBe(200);
  });

  it('empty body means missing PIN (403); malformed JSON is 400', async () => {
    const empty = await call('/api/coach-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(empty.status).toBe(403);

    const bad = await call('/api/coach-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()) as { ok: boolean }).toEqual({
      ok: false,
      error: 'طلب غير صالح.',
    });
  });

  it('treats non-JSON request bodies as an absent PIN like Express', async () => {
    const res = await call('/api/coach-session', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'CF-Connecting-IP': '10.0.0.18',
      },
      body: '{"pin":"97531"}',
    });
    expect(res.status).toBe(403);
  });

  it('returns a safe JSON 404 for unknown API paths', async () => {
    const res = await call('/api/not-a-real-route');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      error: 'المسار غير موجود.',
    });
  });

  it('rejects JSON bodies larger than 200 KiB', async () => {
    const body = JSON.stringify({ pin: 'x'.repeat(210 * 1024) });
    const res = await call('/api/coach-session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': '10.0.0.17',
      },
      body,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      ok: false,
      error: 'حجم الطلب أكبر من المسموح.',
    });
  });

  it('routes work with and without the /api prefix', async () => {
    const res = await call('/coach-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: TEST_PIN }),
    });
    expect(res.status).toBe(200);
  });
});
