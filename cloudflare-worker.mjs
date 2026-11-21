// ============================================================================
// Cloudflare Worker entry — Smart Diet v2 preview (workers.dev, Staging only).
// ----------------------------------------------------------------------------
// - Serves the Vite SPA from Workers Static Assets (ASSETS binding).
// - Routes the coach API (/api/*, /coach-session) through HONO, not Express:
//   Express 4.22.3 cannot even be imported inside a wrangler-bundled Worker —
//   its top-level `exports.json = bodyParser.json` pulls in body-parser →
//   raw-body → iconv-lite, which crashes the bundle with
//   "require_streams(...) is not a function" (workers-sdk #9309, #10022;
//   still present in wrangler 4.166.0 — proven 2026-11-21 by a minimal repro
//   importing only `express`). Hono is Workers-native with zero Node
//   dependencies. The session logic itself is shared: both the Express
//   adapter (Vercel/Node, src/server/api.ts) and this Hono adapter call the
//   same framework-free service (src/server/coachSessionService.ts), so the
//   response contracts are identical; only the HTTP glue differs.
// - Rate limiting stays on the SHARED Upstash Redis store (Worker secrets),
//   per the implementation plan §10: "Rate Limiting يعمل عبر Upstash من
//   Runtime المستقل". No Durable Object store is used here.
// - Health checks (/health, /api/health) answer directly: liveness must not
//   depend on secret configuration. Contract identical to the Express
//   handler: { "status": "ok" }.
// - Fail-closed: with NODE_ENV=production, a missing COACH_PIN or
//   SESSION_SECRET makes validateSecurityConfig() throw, so every session
//   request returns 503 instead of running with dev defaults.
// - NOTIFICATION BOUNDARY: this Worker has no role in Web Push. It must
//   never proxy Supabase Edge Function `notify`, store Push endpoints, or
//   receive VAPID secrets. Push stays Supabase-only (see
//   docs/notifications-architecture.md).
// ============================================================================

import { Hono } from "hono";
import {
  createCoachSession,
  deleteCoachSession,
  validateSecurityConfig,
} from "./src/server/coachSessionService.ts";
import { setServerRuntimeEnv } from "./src/server/runtimeEnv.ts";

const app = new Hono();

function injectEnv(env) {
  // Worker bindings are injected explicitly instead of relying on
  // process.env, which the Worker runtime does not guarantee.
  // NODE_ENV defaults to production (fail-closed); tests may override it.
  setServerRuntimeEnv({
    NODE_ENV: env.NODE_ENV ?? "production",
    COACH_PIN: env.COACH_PIN,
    SESSION_SECRET: env.SESSION_SECRET,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Returns a 503 response when the session service is not configured;
// null when the request may proceed.
function requireConfig(c) {
  injectEnv(c.env);
  try {
    validateSecurityConfig();
  } catch (error) {
    return c.json(
      { ok: false, error: "خدمة الجلسات غير مهيأة. تواصل مع الدعم." },
      503,
    );
  }
  return null;
}

function clientIp(c) {
  return (
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Reads the JSON body like Express's body parser does for our routes:
// an empty body means {} (→ wrong PIN → 403), malformed JSON → 400.
// (One documented difference: Express answers malformed JSON with its
// default HTML error page; the Worker answers with JSON instead.)
async function readJsonBody(c) {
  const raw = await c.req.text();
  if (!raw) return { body: {}, error: null };
  try {
    return { body: JSON.parse(raw), error: null };
  } catch {
    return {
      body: null,
      error: c.json({ ok: false, error: "طلب غير صالح." }, 400),
    };
  }
}

app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/api/health", (c) => c.json({ status: "ok" }));

async function postCoachSession(c) {
  const blocked = requireConfig(c);
  if (blocked) return blocked;
  const { body, error } = await readJsonBody(c);
  if (error) return error;
  const result = await createCoachSession({ ip: clientIp(c), pin: body?.pin });
  return c.json(result.body, result.status);
}
app.post("/coach-session", postCoachSession);
app.post("/api/coach-session", postCoachSession);

async function deleteCoachSessionHandler(c) {
  const blocked = requireConfig(c);
  if (blocked) return blocked;
  const headerToken = c.req.header("x-coach-session");
  const { body, error } = await readJsonBody(c);
  if (error) return error;
  const result = await deleteCoachSession({ token: headerToken || body?.token });
  return c.json(result.body, result.status);
}
app.delete("/coach-session", deleteCoachSessionHandler);
app.delete("/api/coach-session", deleteCoachSessionHandler);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isApi =
      url.pathname === "/health" ||
      url.pathname === "/api/health" ||
      url.pathname === "/coach-session" ||
      url.pathname === "/api/coach-session" ||
      url.pathname.startsWith("/api/");
    if (isApi) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
