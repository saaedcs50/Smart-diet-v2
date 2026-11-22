import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function withHttpServer<T>(app: Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = 'http://127.0.0.1:' + address.port;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('shared Express API application factory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SESSION_SECRET', 'test-secret-for-unit-tests-0123456789');
    vi.stubEnv('COACH_PIN', '97531');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to trusting no proxy hops and disables the Express banner', async () => {
    const { createApiApp } = await import('../src/server/createApiApp');
    const app = createApiApp();

    expect(app.get('trust proxy')).toBe(0);
    expect(app.get('x-powered-by')).toBe(false);
  });

  it('accepts an explicit non-negative proxy hop count', async () => {
    const { createApiApp } = await import('../src/server/createApiApp');
    const app = createApiApp({ trustProxyHops: 2 });

    expect(app.get('trust proxy')).toBe(2);
  });

  it('rejects invalid proxy trust settings', async () => {
    const { createApiApp } = await import('../src/server/createApiApp');

    expect(() => createApiApp({ trustProxyHops: -1 })).toThrow(RangeError);
    expect(() => createApiApp({ trustProxyHops: 1.5 })).toThrow(RangeError);
    expect(() => createApiApp({ trustProxyHops: Number.NaN })).toThrow(RangeError);
  });

  it('serves health and coach-session routes through the shared app', async () => {
    const { createApiApp } = await import('../src/server/createApiApp');
    const app = createApiApp();

    await withHttpServer(app, async (baseUrl) => {
      const health = await fetch(baseUrl + '/api/health', {
        headers: { connection: 'close' },
      });
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: 'ok' });
      expect(health.headers.get('x-powered-by')).toBeNull();

      const session = await fetch(baseUrl + '/api/coach-session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          connection: 'close',
        },
        body: JSON.stringify({ pin: '97531' }),
      });
      expect(session.status).toBe(200);
      const body = (await session.json()) as { ok: boolean; token: string };
      expect(body.ok).toBe(true);
      expect(body.token.split('.')).toHaveLength(3);
    });
  });

  it('returns a safe JSON error for malformed or oversized JSON', async () => {
    const { createApiApp } = await import('../src/server/createApiApp');
    const app = createApiApp();

    await withHttpServer(app, async (baseUrl) => {
      const malformed = await fetch(baseUrl + '/api/coach-session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          connection: 'close',
        },
        body: '{not json',
      });
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toEqual({
        ok: false,
        error: 'طلب غير صالح.',
      });

      const oversizedBody = JSON.stringify({ pin: 'x'.repeat(210 * 1024) });
      const oversized = await fetch(baseUrl + '/api/coach-session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          connection: 'close',
        },
        body: oversizedBody,
      });
      expect(oversized.status).toBe(413);
      expect(await oversized.json()).toEqual({
        ok: false,
        error: 'حجم الطلب أكبر من المسموح.',
      });
    });
  });

  it('returns a JSON 404 for unknown API paths', async () => {
    const { createApiApp } = await import('../src/server/createApiApp');
    const app = createApiApp();

    await withHttpServer(app, async (baseUrl) => {
      const response = await fetch(baseUrl + '/api/not-a-real-route', {
        headers: { connection: 'close' },
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        ok: false,
        error: 'المسار غير موجود.',
      });
    });
  });
});
