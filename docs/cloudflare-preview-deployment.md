# Cloudflare Preview Deployment (Workers + Static Assets)

> Preview only — Staging Supabase, temporary `workers.dev` address.
> No custom domain, no production DNS change, no production data.
> Vercel remains the rollback and is untouched by this work.

- **Preview URL:** https://smart-diet-v2.saaedbelal.workers.dev
- **Worker name:** `smart-diet-v2` (account `6a206beb03d008aba77ff945ea6a68da`)
- **First deployment:** 2026-11-21T05:14:22Z — Version ID
  `daf4a7f7-cd88-4135-8663-344c716206b2` (100% of traffic)
- **Supabase:** Staging only (`dubevgijagqjgwcibqeo`). The production
  project ref is absent from the deployed bundles (verified by grep on the
  live JS asset).

## Architecture

```
Browser ──► Cloudflare Worker `smart-diet-v2`
              ├─ /health, /api/health            → direct JSON {status:"ok"}
              ├─ /coach-session, /api/coach-session
              │     → Hono app → coachSessionService (shared logic)
              │     → rate limiting via Upstash Redis (Worker secrets)
              └─ everything else                 → Static Assets (dist-cf/)
                    SPA fallback → /index.html (incl. /platform)
```

- **Assets directory is `dist-cf/`** (built by `npm run build:cloudflare`),
  not `dist/`. `dist/` contains the Node bundle `dist/server.cjs`, which
  must never be served as a static asset. `dist-cf/` contains only the
  Vite SPA output (verified: no `server.cjs` in it; requesting
  `/server.cjs` on the preview returns the SPA `index.html` via the
  fallback, exactly like Vercel's rewrite).
- **PWA is preserved:** `manifest.json` and `sw.js` are served from the
  asset directory (both return 200 on the preview).
- **Realtime QA harness** (`realtime-qa.html` + `src/platform/realtime-qa.tsx`,
  gated by `VITE_REALTIME_QA_ENABLED=true`) is included so the preview is
  immediately usable for the PROMPT 2 verification. Note: Static Assets
  applies clean-URL redirects, so `/realtime-qa.html` answers 307 to
  `/realtime-qa` (which returns 200). Use `/realtime-qa` on this preview.

## Runtime decision — why Hono, not Express, in the Worker

The implementation plan (§2.6) requires proving Express compatibility
before adopting Workers. **The proof failed, definitively:**

- Express 4.22.3 cannot even be *imported* inside a wrangler-bundled
  Worker. Its top-level `exports.json = bodyParser.json` pulls in
  body-parser → raw-body → iconv-lite, which crashes the bundle with
  `Uncaught TypeError: require_streams(...) is not a function`
  (workers-sdk #9309, #10022). A minimal Worker importing only `express`
  reproduces the crash on wrangler 4.166.0 (2026-11-21). The bug is in
  the esbuild/workerd bundling of iconv-lite 0.4.24, not in our code.
- Cloudflare Containers were evaluated and rejected: paid, slower cold
  starts, and disproportionate for a 3-endpoint API when a supported
  Workers-native runtime exists.
- **Decision:** the Worker API runs on **Hono 4.13.16** (Workers-native,
  zero Node dependencies). The session logic is NOT duplicated: it lives
  once in the framework-free `src/server/coachSessionService.ts`, and
  both adapters call it — `src/server/api.ts` (Express, Vercel/Node) and
  `cloudflare-worker.mjs` (Hono, Workers). Response contracts are
  identical; only the HTTP glue differs.

Two documented edge differences (both outside the tested contract):

1. Malformed JSON body: Express answers with its default HTML 400 page;
   the Worker answers `400 {"ok":false,"error":"طلب غير صالح."}`.
2. Unknown `/api/*` paths: Express answers its default HTML 404; the
   Worker answers Hono's JSON 404.

## Rate limiting — Upstash, not a Durable Object

The Worker uses the **same shared Upstash Redis store** as Vercel, via
the existing `coachGuardStore` (fetch-only REST, no SDK). This keeps
rate-limit state consistent across both origins and satisfies the plan's
§10 closure item ("Rate Limiting يعمل عبر Upstash من Runtime المستقل").
PR #75's branch contains a Durable Object guard-store variant; it was
deliberately NOT reused here — it would split rate-limit state between
origins and fail the §10 item.

## Environment variables

### Build-time (public, baked into the JS bundle at build time)

| Variable | Value for this preview | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Staging project URL | Public by design |
| `VITE_SUPABASE_ANON_KEY` | Staging anon key | Public by design (anon role, RLS-enforced) |
| `VITE_PLATFORM_ENABLED` | `true` | Enables the real platform UI |
| `VITE_REALTIME_QA_ENABLED` | `true` | Preview only — enables `/realtime-qa` |
| `VITE_GOOGLE_OAUTH_ENABLED` | `false` | Google sign-in hidden on the preview |

`VITE_COACH_LOCAL_ONLY` is intentionally unset (the code forces it false
in production builds). `VITE_VAPID_PUBLIC_KEY` is not set for the preview
(push is not part of PROMPT 1).

### Runtime secrets (Worker secrets — NEVER in git, logs, or the bundle)

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC signing key for coach session tokens |
| `COACH_PIN` | Coach PIN for session creation |
| `UPSTASH_REDIS_REST_URL` | Shared Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Shared Upstash Redis REST token |

**Status update (2026-11-21 evening): all four runtime secrets were set on the preview by the project owner.** A live wrong-PIN request returned 403 (rather than the fail-closed 503), confirming configuration and shared Upstash reachability. A correct-PIN request was deliberately not made; the real PIN is not used in automated probes. Secret values remain outside Git and CI logs.

### Setting the secrets (one-time, after retrieving them from Vercel)

Source: Vercel Dashboard → team `smart-diet1` → project `smart-diet-v2`
→ Settings → Environment Variables (Production).

Destination — either:

```bash
# CLI (values are typed at the prompt; never put them in a file or shell history)
npx wrangler secret put SESSION_SECRET
npx wrangler secret put COACH_PIN
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

or Cloudflare Dashboard → Workers & Pages → `smart-diet-v2` →
Settings → Variables → Secrets. Setting a secret redeploys the Worker
automatically; no code change is needed. After setting them, verify:
`POST /api/coach-session` with the correct PIN must return 200 with a
token (see "Verification" below).

## Deploy

### Manual (CLI)

```bash
npm run build:cloudflare   # needs the VITE_* build vars (see .env.example)
npx wrangler deploy        # needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
```

### GitHub Actions

`.github/workflows/cloudflare-worker.yml` (manual dispatch only):
builds with the `VITE_*` values from repo Variables, runs a
`wrangler deploy --dry-run` validation, then deploys with the
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets.
It never sets runtime secrets — those are managed out-of-band (above).

When frontend and API use different origins, set Worker runtime variable API_ALLOWED_ORIGINS to the exact frontend origin (comma-separated when multiple are approved). Keep VITE_API_BASE_URL empty when using this Worker's same-origin frontend/API route. The policy never enables wildcard origins or credentialed CORS.

## Verification (2026-11-21, all via curl — no browser)

Local (`wrangler dev` + mock Upstash + dummy `.dev.vars`, deleted after):

| Check | Result |
|---|---|
| `GET /` | 200 HTML |
| `GET /platform` (SPA fallback) | 200 `index.html` |
| `GET /api/health`, `GET /health` | 200 `{"status":"ok"}` |
| `POST /api/coach-session` wrong PIN | 403 `رمز PIN غير صحيح.` |
| `POST /api/coach-session` correct PIN | 200, 3-part HMAC token |
| 5× wrong PIN then 6th | 403 ×5, then 429 lockout message |
| `DELETE /api/coach-session` with token | 200 `{"ok":true}` |
| `GET /manifest.json` | 200 |
| `GET /realtime-qa.html` | 307 → `/realtime-qa` → 200 |
| `GET /server.cjs` | 200 `index.html` (SPA fallback; bundle file not in assets) |
| Without `.dev.vars` (fail-closed) | health 200, coach-session 503, root 200 |

Live preview (https://smart-diet-v2.saaedbelal.workers.dev):

| Check | Result |
|---|---|
| `GET /` | 200, valid HTTPS |
| `GET /platform` | 200 `index.html` |
| JS asset `/assets/index-*.js` | 200 |
| `GET /manifest.json` | 200 |
| `GET /realtime-qa.html` | 307 → `/realtime-qa` → 200 |
| `GET /api/health` | 200 `{"status":"ok"}` |
| `POST /api/coach-session` wrong PIN | 403 (runtime secrets + shared Upstash verified; real correct PIN not probed) |
| `GET /server.cjs` | 200 `index.html` (not the bundle) |
| Staging ref in live bundle / prod ref | staging present, prod absent (0 matches) |

Tests: `npm test` — **343 passed (46 files)**, including 8 new
`tests/workerApi.test.ts` tests for the Hono adapter (health without
secrets, fail-closed 503, token issue + revoke, lockout, malformed JSON,
both route prefixes). `npm run lint` — 0 errors, 259 warnings (all
pre-existing in untouched files).

## Rollback

- Vercel is untouched and remains the production host. Removing the
  preview is a single command (`npx wrangler delete smart-diet-v2`) or
  deleting the Worker in the Cloudflare dashboard; no DNS or data is
  involved.
- The Worker never touches the `youngtube-worker` or any other
  Cloudflare resource.

## Still needs browser verification (not verifiable by curl)

- Service Worker registration + offline behaviour on the preview.
- Login page behaviour (needs real credentials — not attempted).
- Google OAuth button hidden (`VITE_GOOGLE_OAUTH_ENABLED=false`).
- Realtime QA page render at `/realtime-qa` (needs a logged-in session).
- PWA install prompt.

## Notification boundary

This Worker has no role in Web Push. It must never proxy Supabase Edge
Function `notify`, store Push endpoints, or receive VAPID secrets. Push
stays Supabase-only (see `docs/notifications-architecture.md`).
