// Host-independent API URL resolver.
// Leave VITE_API_BASE_URL empty to preserve the current same-origin behaviour.
type BuildEnv = { VITE_API_BASE_URL?: string };
function configuredBase(): string {
  const viteEnv = (import.meta as unknown as { env?: BuildEnv }).env;
  if (viteEnv?.VITE_API_BASE_URL !== undefined) return viteEnv.VITE_API_BASE_URL;
  return (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.VITE_API_BASE_URL ?? '';
}

/** Pure resolver, exported so validation can be tested without a browser. */
export function resolveApiRequestUrl(path: string, rawBase = ''): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('API paths must be absolute same-origin paths.');
  }

  const base = rawBase.trim();
  if (!base) return path;

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new TypeError('VITE_API_BASE_URL must be a valid absolute URL.');
  }

  const isLocalHttp = parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]');
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new TypeError('VITE_API_BASE_URL must use HTTPS (HTTP is allowed only for localhost).');
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new TypeError('VITE_API_BASE_URL must contain only the API origin, without credentials, path, query, or fragment.');
  }

  return new URL(path, parsed.origin).toString();
}

export function apiUrl(path: string): string {
  return resolveApiRequestUrl(path, configuredBase());
}
