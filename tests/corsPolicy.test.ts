import { describe, expect, it } from 'vitest';
import { corsHeadersForOrigin, parseAllowedOrigins } from '../src/server/corsPolicy';

describe('API CORS allowlist', () => {
  it('matches an exact HTTPS origin and exposes only required methods and headers', () => {
    const allowed = parseAllowedOrigins('https://app.example.test, https://preview.example.test/');
    const headers = corsHeadersForOrigin('https://app.example.test', allowed);
    expect(headers).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.test',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-coach-session',
      Vary: 'Origin',
    });
    expect(corsHeadersForOrigin('https://evil.example.test', allowed)).toBeNull();
  });

  it('rejects wildcard, paths, credentials, and insecure remote origins', () => {
    expect(() => parseAllowedOrigins('*')).toThrow();
    expect(() => parseAllowedOrigins('https://app.example.test/path')).toThrow();
    expect(() => parseAllowedOrigins('https://user:pass@app.example.test')).toThrow();
    expect(() => parseAllowedOrigins('http://app.example.test')).toThrow();
  });

  it('allows localhost HTTP only for local development', () => {
    expect(parseAllowedOrigins('http://localhost:5173').has('http://localhost:5173')).toBe(true);
  });
});
