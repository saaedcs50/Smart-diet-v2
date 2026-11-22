import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};

describe('coach session API origin portability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('localStorage', localStorageMock);
    store.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the configured API origin for session creation and revocation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'wrong PIN' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { StorageKeys } = await import('../src/utils/storageKeys');
    const coachServer = await import('../src/utils/coachServer');

    const createResult = await coachServer.createCoachServerSession('12345');
    expect(createResult.status).toBe('rejected');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/coach-session',
      expect.objectContaining({ method: 'POST' }),
    );

    localStorageMock.setItem(StorageKeys.coachSessionToken(), 'token.payload.signature');
    await coachServer.deleteCoachServerSession();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/coach-session',
      expect.objectContaining({
        method: 'DELETE',
        headers: { 'x-coach-session': 'token.payload.signature' },
      }),
    );
    expect(localStorageMock.getItem(StorageKeys.coachSessionToken())).toBeNull();
  });
});
