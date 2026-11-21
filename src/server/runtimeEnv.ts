// Server environment adapter.
// Node/Vercel continues to read process.env. Cloudflare Workers injects
// deployment bindings without mutating the Worker process environment.
const injected: Record<string, string | undefined> = {};

export function setServerRuntimeEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) injected[key] = value;
}

export function getServerRuntimeEnv(key: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(injected, key)) return injected[key];
  return (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.[key];
}
