// ============================================================================
// Cloudflare Worker entry — Smart Diet v2 preview (workers.dev, Staging only).
// ----------------------------------------------------------------------------
// - Serves the Vite SPA from Workers Static Assets (ASSETS binding).
// - Routes the coach API (/api/*, /coach-session) through Hono, not Express.
// - Both HTTP adapters delegate security-sensitive session logic to the same
//   framework-free coachSessionService.ts implementation.
// - Rate limiting uses the shared Upstash Redis store; no Durable Object store.
// - The Worker has no role in Web Push; notify remains Supabase-only.
// ============================================================================

import { Hono } from "hono";
import {
  createCoachSession,
  deleteCoachSession,
  validateSecurityConfig,
} from "./src/server/coachSessionService.ts";
import { setServerRuntimeEnv } from "./src/server/runtimeEnv.ts";

const app = new Hono();
const MAX_JSON_BODY_BYTES = 200 * 1024;
const INVALID_JSON_BODY = { ok: false, error: "طلب غير صالح." };
const OVERSIZED_BODY = { ok: false, error: "حجم الطلب أكبر من المسموح." };

function injectEnv(env) {
  setServerRuntimeEnv({
    NODE_ENV: env.NODE_ENV ?? "production",
    COACH_PIN: env.COACH_PIN,
    SESSION_SECRET: env.SESSION_SECRET,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function requireConfig(c) {
  injectEnv(c.env);
  try {
    validateSecurityConfig();
  } catch {
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

async function readJsonBody(c) {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return { body: null, error: c.json(OVERSIZED_BODY, 413) };
  }

  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    return { body: null, error: c.json(OVERSIZED_BODY, 413) };
  }
  if (!raw) return { body: {}, error: null };

  try {
    return { body: JSON.parse(raw), error: null };
  } catch {
    return { body: null, error: c.json(INVALID_JSON_BODY, 400) };
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

// Keep unknown API routes on the same safe JSON contract as Express.
app.notFound((c) => c.json({ ok: false, error: "المسار غير موجود." }, 404));

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isApi =
      url.pathname === "/api" ||
      url.pathname === "/health" ||
      url.pathname === "/api/health" ||
      url.pathname === "/coach-session" ||
      url.pathname === "/api/coach-session" ||
      url.pathname.startsWith("/api/");

    if (isApi) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
