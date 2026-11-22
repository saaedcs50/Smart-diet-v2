// Exact-origin CORS policy shared by Node and Cloudflare HTTP adapters.
export type CorsHeaderMap = Record<string, string>;

export function parseAllowedOrigins(raw: string | undefined): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const item of (raw ?? '').split(',')) {
    const value = item.trim();
    if (!value) continue;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('API_ALLOWED_ORIGINS must contain comma-separated origins only.');
    }

    const localHttp = parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]');
    if (
      (parsed.protocol !== 'https:' && !localHttp) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('API_ALLOWED_ORIGINS must contain HTTPS origins only (HTTP is allowed for localhost).');
    }
    origins.add(parsed.origin);
  }
  return origins;
}

export function corsHeadersForOrigin(
  origin: string | null,
  allowedOrigins: ReadonlySet<string>,
): CorsHeaderMap | null {
  if (!origin || !allowedOrigins.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-coach-session',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
