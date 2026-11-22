import { describe, expect, it } from 'vitest';
import { resolveNodeRuntimeMode } from '../src/server/runtimeMode';

describe('standalone Node runtime mode', () => {
  it('defaults direct launches and start commands to production', () => {
    expect(resolveNodeRuntimeMode({})).toBe('production');
    expect(resolveNodeRuntimeMode({ npm_lifecycle_event: 'start' })).toBe('production');
  });

  it('defaults the supported npm dev command to development', () => {
    expect(resolveNodeRuntimeMode({ npm_lifecycle_event: 'dev' })).toBe('development');
  });

  it('respects an explicitly configured runtime mode', () => {
    expect(resolveNodeRuntimeMode({ NODE_ENV: 'test' })).toBe('test');
    expect(
      resolveNodeRuntimeMode({ NODE_ENV: ' production ', npm_lifecycle_event: 'dev' })
    ).toBe('production');
  });

  it('treats an empty NODE_ENV as unconfigured', () => {
    expect(resolveNodeRuntimeMode({ NODE_ENV: '   ' })).toBe('production');
  });
});
