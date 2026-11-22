import { describe, expect, it } from 'vitest';
import { resolveApiRequestUrl } from '../src/utils/apiClient';

describe('host-independent API URL resolver', () => {
  it('keeps same-origin paths when no API origin is configured', () => {
    expect(resolveApiRequestUrl('/api/coach-session')).toBe('/api/coach-session');
  });

  it('resolves paths against an HTTPS API origin', () => {
    expect(resolveApiRequestUrl('/api/coach-session', 'https://api.example.test'))
      .toBe('https://api.example.test/api/coach-session');
  });

  it('allows HTTP only for local development', () => {
    expect(resolveApiRequestUrl('/health', 'http://localhost:3000'))
      .toBe('http://localhost:3000/health');
  });

  it.each([
    'http://api.example.test',
    'javascript:alert(1)',
    'https://user:pass@api.example.test',
    'https://api.example.test/path',
    'https://api.example.test?x=1',
  ])('rejects an unsafe or non-origin API base: %s', (base) => {
    expect(() => resolveApiRequestUrl('/api/coach-session', base)).toThrow();
  });

  it('rejects protocol-relative or malformed API paths', () => {
    expect(() => resolveApiRequestUrl('//evil.test/path')).toThrow();
    expect(() => resolveApiRequestUrl('api/coach-session')).toThrow();
  });
});
