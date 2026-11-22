export interface RuntimeModeEnvironment {
  NODE_ENV?: string;
  npm_lifecycle_event?: string;
}

/**
 * Production is the safe default for a directly launched server process.
 * The supported npm development command is the only implicit development
 * path; an explicitly configured NODE_ENV always takes precedence.
 */
export function resolveNodeRuntimeMode(env: RuntimeModeEnvironment): string {
  const configured = env.NODE_ENV?.trim();
  if (configured) return configured;
  return env.npm_lifecycle_event === 'dev' ? 'development' : 'production';
}
