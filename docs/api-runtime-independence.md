# Smart Diet API Runtime — Phase 2

## Purpose and deployment boundary

The API business logic is independent from the hosting adapter. The Express
application is built once by src/server/createApiApp.ts and is used by both:

- Vercel: api/index.ts exports the shared Express application.
- Standalone Node: server.ts adds the same API application before attaching
  Vite middleware in development or the built SPA assets in production.

The Cloudflare Worker remains a separate Workers-native Hono adapter. It
shares the framework-free coachSessionService.ts service with Express; Express
itself is not imported into the Worker runtime.

Supabase remains the system of record for PostgreSQL, Auth, RLS, Realtime,
Storage, and Edge Functions. No patient data or notification workload is
moved to the Node server or Cloudflare. The push path remains the browser
calling the Supabase notify Edge Function directly.

## Route inventory

All current Express API routes are listed below. Both prefixed and unprefixed
forms are retained for existing proxy/rewrite compatibility.

| Method | Path | Authentication / input | Dependencies | Result |
|---|---|---|---|---|
| GET | /health | No user authentication | None | 200 {status: ok}; no secrets disclosed |
| GET | /api/health | No user authentication | None | Same health contract |
| POST | /coach-session | Clinic coach PIN in JSON body | COACH_PIN, SESSION_SECRET, Upstash | 200 signed token; 403 wrong PIN; 429 lockout; 503 when the guard store is unavailable |
| POST | /api/coach-session | Same as above | Same as above | Same contract |
| DELETE | /coach-session | HMAC token in x-coach-session header or JSON body | SESSION_SECRET, Upstash revocation store | 200 {ok: true} |
| DELETE | /api/coach-session | Same as above | Same as above | Same contract |
| Any other /api/* | JSON 404 | No authentication | None | 404 with a safe Arabic error |

The current coach-session API is the legacy clinic PIN mechanism. It does not
consume a Supabase User JWT, cookie, patient record, or clinic database row.
The platform's account login is handled directly by Supabase Auth in the
frontend. The API does not expose patient-data routes.

## Authentication, secrets, and rate limiting

Production startup requires NODE_ENV=production, COACH_PIN, and SESSION_SECRET.
The PIN is verified on the server; tokens are HMAC-signed and time-limited.
The raw token is not persisted by the Upstash revocation store (its key is a
SHA-256 digest).

Production also fails closed when UPSTASH_REDIS_REST_URL or
UPSTASH_REDIS_REST_TOKEN is missing or the Upstash service is unavailable.
The shared Upstash store is used by Vercel and Cloudflare so failed-attempt
and revocation state is not split between runtimes.

No PIN, signing secret, Upstash token, Authorization value, or patient data
is written to application logs or returned in health/error responses.

## Proxy trust and client IP

- Standalone Node defaults to TRUST_PROXY_HOPS=0. Client-supplied
  X-Forwarded-For is not trusted when the server is directly exposed.
- Set TRUST_PROXY_HOPS to the exact number of trusted reverse-proxy hops
  only when the deployment is actually behind those proxies. Do not set it
  to an unrestricted trust value.
- The Vercel adapter explicitly trusts its single platform proxy hop.
- The Cloudflare adapter uses CF-Connecting-IP, with X-Forwarded-For only
  as its documented fallback.

This setting determines req.ip and therefore the Upstash per-IP guard key.
Incorrect proxy trust can either collapse all users onto one key or let a
caller spoof the key, so it must match the actual network topology.

## CORS, cookies, and request headers

The current API is same-origin with the frontend on each deployment. It does
not set cookies, use credentialed CORS, or consume a Supabase Authorization
Bearer token. Therefore no wildcard CORS policy is enabled. Browser calls
from the same origin do not need CORS.

When a future frontend deployment uses a separate API origin, add an explicit
origin allow-list and preflight policy as part of the frontend/API-origin
integration. Do not enable Access-Control-Allow-Origin: * with credentials
and do not treat CORS as authentication. The API currently reads
x-coach-session only for session revocation and JSON pin/token request bodies.

## Request limits and error handling

- JSON body limit: 200 KiB.
- Malformed JSON: 400 with a safe JSON response.
- Request body above the limit: 413 with a safe JSON response.
- Wrong PIN: 403.
- Rate limit lockout: 429.
- Missing/unavailable production guard configuration: 503.
- Unexpected server errors: generic 500; no stack trace is returned.
- Unknown /api/* routes: consistent JSON 404 in Express and Worker adapters.
- Health checks are independent from session secrets and remain available
  when the coach-session subsystem is not configured.

## Runtime environment

| Variable | Runtime | Purpose | Default / requirement |
|---|---|---|---|
| NODE_ENV | Node / Vercel / Worker | Runtime mode | Must be production in deployed production environments |
| PORT | Standalone Node | HTTP listen port | 3000 when unset; hosting platform may inject it |
| HOST | Standalone Node | Bind interface | 0.0.0.0 when unset |
| TRUST_PROXY_HOPS | Standalone Node | Trusted reverse-proxy hop count | 0; non-negative integer |
| COACH_PIN | Server secret | Clinic coach PIN | Required in production |
| SESSION_SECRET | Server secret | HMAC signing key | Required in production |
| UPSTASH_REDIS_REST_URL | Server secret/config | Shared Rate Limit + revocation store | Required in production |
| UPSTASH_REDIS_REST_TOKEN | Server secret | Shared Upstash credential | Required in production |
| VITE_SUPABASE_URL | Frontend build | Supabase project URL | Public frontend setting; not read by this API |
| VITE_SUPABASE_ANON_KEY | Frontend build | Supabase anon key | Public frontend key; RLS remains authoritative |
| Supabase Vault VAPID values | Supabase Edge Function only | Push signing | Never copy to Node, Vercel frontend variables, or Cloudflare |

## Standalone Node operation

- Runtime: Node.js 24.x (matches package.json engines).
- Build: npm run build.
- Start: npm start (runs node dist/server.cjs).
- Local development: npm run dev.
- Health: GET /api/health or GET /health.
- Supply secrets through the host's protected environment settings.
- Configure TRUST_PROXY_HOPS only after confirming the reverse-proxy chain.

The server now reads PORT and HOST from the environment, validates proxy
trust configuration, and handles SIGTERM/SIGINT by closing HTTP and Vite
resources gracefully. Host-provided environment variables take precedence
over a local .env file.

## Phase 2 verification scope

CI runs TypeScript, ESLint, the full Vitest suite, and the production build.
The API integration tests exercise the shared Express factory, health route,
PIN session creation, proxy trust configuration, safe parser errors, request
size limits, and unknown API route handling. Worker tests verify the matching
HTTP error contracts.

This is application/runtime verification. It does not claim that a separate
managed Node host has been provisioned or that production traffic was moved.
Vercel remains the rollback and production is not changed by this phase.
