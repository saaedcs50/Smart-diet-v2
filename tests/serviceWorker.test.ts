import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const serviceWorkerSource = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
);

type WorkerEvent = Record<string, unknown>;
type WorkerHandler = (event: WorkerEvent) => void;

function createServiceWorkerHarness(options?: {
  fetchImpl?: (request: { url: string; mode: string; method: string }) => Promise<unknown>;
  windowClients?: Array<{
    url: string;
    postMessage: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
  }>;
}) {
  const handlers = new Map<string, WorkerHandler>();
  const storedResponses = new Map<string, unknown>();
  const cacheNames = new Set<string>();
  const cache = {
    addAll: vi.fn(async (paths: string[]) => {
      paths.forEach((path) => storedResponses.set(path, { cachedPath: path }));
    }),
    put: vi.fn(async (request: string | { url: string }, response: unknown) => {
      const key = typeof request === 'string' ? request : request.url;
      storedResponses.set(key, response);
    }),
  };

  const cachesApi = {
    open: vi.fn(async (name: string) => {
      cacheNames.add(name);
      return cache;
    }),
    keys: vi.fn(async () => [...cacheNames, 'old-app-cache']),
    delete: vi.fn(async (name: string) => cacheNames.delete(name)),
    match: vi.fn(async (request: string | { url: string }) => {
      const key = typeof request === 'string' ? request : request.url;
      return storedResponses.get(key);
    }),
  };

  const existingClient = options?.windowClients?.[0];
  const clients = {
    claim: vi.fn(async () => undefined),
    matchAll: vi.fn(async () => options?.windowClients ?? []),
    openWindow: vi.fn(async () => undefined),
  };
  const self = {
    addEventListener: (type: string, handler: WorkerHandler) => handlers.set(type, handler),
    skipWaiting: vi.fn(async () => undefined),
    clients,
    registration: {
      showNotification: vi.fn(async () => undefined),
    },
    location: { origin: 'https://app.test' },
  };
  const fetchImpl = options?.fetchImpl ?? vi.fn(async () => ({
    ok: true,
    clone: () => ({ fromNetwork: true }),
  }));

  runInNewContext(serviceWorkerSource, {
    self,
    caches: cachesApi,
    fetch: fetchImpl,
    URL,
  });

  return {
    handlers,
    self,
    clients,
    caches: cachesApi,
    cache,
    storedResponses,
    fetchImpl,
    existingClient,
  };
}

async function runLifecycleEvent(
  handler: WorkerHandler,
  event: WorkerEvent,
): Promise<void> {
  let pending: Promise<unknown> | undefined;
  handler({
    ...event,
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    },
  });
  await pending;
}

describe('service worker offline app-shell contract', () => {
  it('precaches the app shell during install and activates immediately', async () => {
    const harness = createServiceWorkerHarness();
    const install = harness.handlers.get('install');
    expect(install).toBeDefined();

    await runLifecycleEvent(install!, {});
    expect(harness.cache.addAll).toHaveBeenCalledWith([
      '/',
      '/index.html',
      '/manifest.json',
      '/icon.svg',
    ]);
    expect(harness.self.skipWaiting).toHaveBeenCalledOnce();
  });

  it('removes stale caches and claims existing clients on activation', async () => {
    const harness = createServiceWorkerHarness();
    await runLifecycleEvent(harness.handlers.get('install')!, {});
    await runLifecycleEvent(harness.handlers.get('activate')!, {});

    expect(harness.caches.delete).toHaveBeenCalledWith('old-app-cache');
    expect(harness.clients.claim).toHaveBeenCalledOnce();
  });

  it('serves the cached app shell when a navigation request is offline', async () => {
    const fallback = { body: 'cached index.html' };
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const harness = createServiceWorkerHarness({ fetchImpl });
    harness.storedResponses.set('/index.html', fallback);

    let responsePromise: Promise<unknown> | undefined;
    harness.handlers.get('fetch')!({
      request: {
        url: 'https://app.test/patient',
        method: 'GET',
        mode: 'navigate',
      },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
    });

    await expect(responsePromise).resolves.toBe(fallback);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('uses the cached copy of static assets before making a network request', async () => {
    const cachedAsset = { body: 'cached javascript' };
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const harness = createServiceWorkerHarness({ fetchImpl });
    harness.storedResponses.set('https://app.test/assets/app.js', cachedAsset);

    let responsePromise: Promise<unknown> | undefined;
    harness.handlers.get('fetch')!({
      request: {
        url: 'https://app.test/assets/app.js',
        method: 'GET',
        mode: 'cors',
      },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
    });

    await expect(responsePromise).resolves.toBe(cachedAsset);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not intercept API requests that must always reach the network', () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const harness = createServiceWorkerHarness({ fetchImpl });
    const respondWith = vi.fn();

    harness.handlers.get('fetch')!({
      request: {
        url: 'https://app.test/rest/v1/day_logs',
        method: 'GET',
        mode: 'cors',
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('focuses the open app and forwards notification-click metadata', async () => {
    const client = {
      url: 'https://app.test/',
      postMessage: vi.fn(),
      focus: vi.fn(async () => undefined),
    };
    const harness = createServiceWorkerHarness({ windowClients: [client] });
    const close = vi.fn();
    await runLifecycleEvent(harness.handlers.get('notificationclick')!, {
      notification: {
        close,
        tag: 'meal-reminder',
        data: { url: '/?tab=today' },
      },
      action: 'open',
    });

    expect(close).toHaveBeenCalledOnce();
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'NOTIFICATION_CLICKED',
      tag: 'meal-reminder',
      url: '/?tab=today',
    });
    expect(client.focus).toHaveBeenCalledOnce();
  });
});
