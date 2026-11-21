# Cloudflare Independence + Security Review — Smart-diet-v2 Phase 1 Closure

**Date:** 2026-11-21 (evening, Cairo) · **Preview:** https://smart-diet-v2.saaedbelal.workers.dev
(Staging only) · **main HEAD at time of writing:** `89fb4619` (PR #84 merged — C2 closed by
decision) · **Scope:** verification only — no code, configuration, deployment, or Supabase
change was made in this review. Every check below was re-verified live tonight; morning
results were not trusted without a fresh check.

Builds on: `docs/cloudflare-preview-deployment.md` (PROMPT 1),
`docs/auth-oauth-verification-2026-11-21.md` (PROMPT 3),
`docs/local-data-pwa-verification-2026-11-21.md` (PROMPT 5),
`docs/phase-1-final-closure-report.md` (PROMPT 6, updated evening for C2).

## Verdict summary

| # | Check | Verdict |
|---|---|---|
| 1 | Preview live + independent (Staging only) | **PASS** — all 8 endpoints 200; staging ref 4× / prod ref 0× across all 10 live bundles |
| 2 | Hono API runtime + shared business logic | **PASS** — thin Hono adapter over the single shared service |
| 3 | Upstash rate-limit wiring (no Durable Object) | **PASS** — shared Upstash store, per-IP keys, 5 attempts → 5-min lockout doubling to 60-min cap |
| 4 | Wrong-PIN 403 + lockout behaviour | **PASS (403 proven live ×6); lockout (429) NOT demonstrated live — not feasible from this VM** (rotating egress IP; proven in tests + local wrangler dev instead) |
| 5 | No secrets in frontend | **PASS** — 0 secret patterns in all 10 live bundles and in tracked source; `wrangler.jsonc` carries no vars or secrets |
| 6 | No Vercel dependency in the Worker path | **PASS** — 0 `vercel.app` references in the Worker, `src/`, or live bundles |
| 7 | Push still via Supabase Edge Function `notify` | **PASS** — `push.ts` calls `functions/v1/notify` directly; no Worker proxy exists |
| 8 | No patient data flows to Cloudflare | **PASS** — the Worker handles only health + coach-session + static assets; no Supabase/patient code path |
| 9 | Supabase Staging connectivity | **PASS** — Auth + REST endpoints up (401 without a key, as expected); bundle config is Staging-only |
| 10 | Security review (code + tests) | **PASS — no critical/high unaddressed finding; nothing here blocks Phase 1 closure** |

**Closure-blocking verdict: none found.** No critical or high-severity unaddressed issue
was found in this review. The remaining Phase 1 close-out items (C1 disposable-Supabase
restore test, C3 full T1 live proof) are outside this review's scope and are unaffected
by it. Findings F1–F8 below are Low/Info, with F2–F4 already recorded in PROMPT 5/6.

## 1. Live preview verification (fresh, tonight)

All endpoints curled 2026-11-21 ~21:50 Cairo (no browser, no credentials):

| Endpoint | Result |
|---|---|
| `GET /` | 200 (0.46 s) |
| `GET /platform` | 200 |
| `GET /api/health` | 200 `{"status":"ok"}` |
| `GET /health` | 200 |
| `GET /manifest.json` | 200 |
| `GET /realtime-qa` | 200 |
| `GET /sw.js` | 200 — **byte-identical to `public/sw.js` on main** (`diff` clean, re-verified tonight) |
| `GET /coach` | 200 |
| `GET /server.cjs` | 200 via SPA fallback (the Node bundle is NOT served as an asset) |
| `GET /api/does-not-exist` | 404 plain-text `Not Found` (Hono default — see correction §11.1) |
| `DELETE /api/coach-session` (no token) | 200 `{"ok":true}` — matches the service contract (no token → nothing to revoke, still 200); no state changed |
| `POST /api/coach-session` (malformed JSON) | 400 `{"ok":false,"error":"طلب غير صالح."}` — the documented Worker edge difference (Express answers HTML 400) |

**Live bundle scan (all 10 bundles, same set as PROMPT 3 V1):** the 5 HTML-referenced
bundles (`index-xfudTUID.js`, `index-Dt17Hx_T.js`, `vendor-react`, `vendor-motion`,
`vendor-pdf`) plus the 5 lazy chunks (`PlatformApp-Ddi3eQuB.js`, `OwnerApp-DNqpHHAb.js`,
`auth-Bot04il5.js`, `index-CGc_CKmv.js`, `realtimeQa-mCPkV6PN.js`) were fetched fresh
(all 200) and scanned:

| Pattern | Matches in 10 live bundles |
|---|---|
| Staging ref `dubevgijagqjgwcibqeo` | 4 (main 2 + PlatformApp 1 + realtime-qa 1 — same total as PROMPT 3) |
| Production ref `lhjyshlxbsnesayivxpb` | **0** |
| `service_role` / `client_secret` / `apps.googleusercontent.com` / `BEGIN PRIVATE KEY` / `UPSTASH` / `SESSION_SECRET` / `COACH_PIN` | **0 each** |
| `vercel.app` | **0** |

**Live headers (re-verified tonight):** `/`, `/sw.js`, and
`/assets/index-xfudTUID.js` all return `Cache-Control: public, max-age=0,
must-revalidate` — the D1 premise (HTTP cache is not an offline fallback) still holds.

## 2. Hono API runtime + shared business logic — PASS

`cloudflare-worker.mjs` is a thin Hono 4.13.16 adapter (package.json: `"hono": "4.13.16"`):

- Imports only the framework-free service functions (`cloudflare-worker.mjs:36-40`):
  `createCoachSession`, `deleteCoachSession`, `validateSecurityConfig` from
  `./src/server/coachSessionService.ts`, plus `setServerRuntimeEnv` from
  `./src/server/runtimeEnv.ts`.
- The Hono handlers do HTTP glue only: `requireConfig()` (env injection + boot
  validation, lines 52-66), `clientIp()` (`CF-Connecting-IP` first, lines 68-75),
  `readJsonBody()` (lines 82-96), then delegate to the shared service
  (`postCoachSession`, lines 101-108; `deleteCoachSessionHandler`, lines 110-119).
- The `fetch` entry (lines 121-132) routes `/health`, `/api/health`,
  `/coach-session`, `/api/coach-session`, and `/api/*` to Hono; everything else goes
  to `env.ASSETS.fetch(request)` (Static Assets).
- The Express adapter (`src/server/api.ts`) calls the **same** service functions
  (`handleCreateSession`, lines 30-34; `handleDeleteSession`, lines 37-42) — one
  implementation, two thin adapters, identical response contracts. `api/index.ts`
  is the Vercel bootstrap only (dotenv, `trust proxy 1`, mounts `apiRouter`).
- The header comment (lines 1-34) documents the Express impossibility proof
  (iconv-lite bundle crash, wrangler 4.166.0) and the notification boundary.

No business logic is duplicated between runtimes. The only runtime differences are the
two documented edge cases (malformed JSON 400 format; unknown `/api/*` 404 format),
both outside the tested contract — and §11.1 corrects the 404 description.

## 3. Upstash rate-limit wiring — PASS

Traced in `src/server/coachGuardStore.ts` (the only guard store in the Worker path):

| Aspect | Code | Behaviour |
|---|---|---|
| Key scope | `rlKey(ip)` = `` `sd:coach:rl:${ip}` `` (line 137) | **Per-IP.** The Worker passes `CF-Connecting-IP` (`cloudflare-worker.mjs:68-75`); Express passes `req.ip` (`api.ts:31`, behind `trust proxy 1`) |
| Threshold | `MAX_ATTEMPTS = 5` (line 19) | 5 failed attempts, then lockout |
| Lockout | `LOCKOUT_MS = 5 min`, doubling per lockout, `MAX_LOCKOUT_MS = 60 min` (lines 20-21, 57-59) | First lockout 5 min; 5 → 10 → 20 → 40 → 60 (capped) |
| Entry TTL | `SET … EX 3900` (line 163) | 65 min — covers the longest lockout + margin; a stale counter expires on its own |
| Revocation | `revKey(token)` = SHA-256 of the token (lines 141-144) | The raw token is never stored; TTL = token expiry |
| Store selection | `getCoachGuardStore()` (lines 189-208) | Upstash REST (fetch-only, no SDK) when URL + token are set; **fail-closed in production** — throws `GuardUnavailableError` (→ 503 with the Arabic «مخزن الحماية غير مهيأ…» message) if they are missing; memory store only outside production |
| Durable Objects | None | Zero `durable` references in the Worker path except the comment «No Durable Object store is used here» (`cloudflare-worker.mjs:18`). PR #75's Durable Object variant was deliberately not reused (it would split state between origins) |
| Shared across runtimes | Same Upstash database, same key namespace | Vercel and Workers share one guard store — the plan §10 item 5 design |

**Local proof that the lockout works** (same code path, not live): PROMPT 1 doc —
local `wrangler dev` with mock Upstash: 5× wrong PIN → 403 ×5, 6th → 429 lockout
message. Tests: `tests/workerApi.test.ts:117` («fifth failure still 403, sixth locks
the ip (429)», plus «Another IP is unaffected» — per-IP proof);
`tests/serverApi.test.ts:121-128` (429 + `isLockedOut` per IP + `clearAttempts`
reset); `tests/coachAuth.test.ts:140` (client-side local lockout).

## 4. Wrong-PIN / lockout verification — 403 proven live; 429 not feasible from this VM

### 4.1 What was done tonight (strict budget, code read first)

The guard code (§3) was read **before** any probe. Key scope confirmed per-IP;
first lockout confirmed short and known (5 min). Probe log (all `POST
/api/coach-session` with PIN `00000`, from this VM):

| Probe | Time (UTC) | Result |
|---|---|---|
| 1 | 19:49 | **403** `{"ok":false,"error":"رمز PIN غير صحيح."}` |
| 2 | 19:50:46 | 403 |
| 3 | 19:50:47 | 403 |
| 4 | 19:50:48 | 403 |
| 5 | 19:50:49 | 403 |
| 6 (lockout confirmation) | 19:50:54 | **403 — expected 429, did not lock** |

**Total wrong-PIN probes tonight: 6, all 403.** No correct-PIN probe was made (the
real PIN is سعيد's; this review never had it). No further probes were made after the
explanation below was established.

### 4.2 Why probe 6 was 403, not 429 — the VM's egress IP rotates per request

The per-IP counter can only accumulate if the Worker sees the same IP for consecutive
requests. It does not — this VM's egress IP changes on **every** request:

```
ifconfig.me (IPv6, 6 tries): 6 distinct addresses (2a04:4e41:4:355a::…,
  2a04:4e41:24:3e43::…, 2a04:4e41:2c:606d::…, 2a04:4e41:34:7416::…,
  2a04:4e41:4c:4d3c::…, 2a04:4e41:8:44bc::…)
api.ipify.org (IPv4, 3 tries): 3 distinct addresses (104.29.200.165,
  104.29.192.133, 104.29.193.195)
```

Each of the 6 probes therefore landed on a **different** `sd:coach:rl:<ip>` key
(count 1 each, never 5). The lockout logic is not broken — it simply never saw 5
attempts from one IP. Two alternative explanations were ruled out:

- **Memory store instead of Upstash?** Ruled out by the morning's evidence: before
  the Upstash secrets were set, the Worker returned the production-only
  `GuardUnavailableError` message («مخزن الحماية غير مهيأ…»), which is thrown only
  in the production branch when the Upstash vars are missing. `NODE_ENV` is
  `production` in the Worker and the store is Upstash.
- **Morning attempts still counted?** No — the entry TTL is 65 min
  (`coachGuardStore.ts:163`); the morning's attempts expired ~08:52 Cairo, ~13
  hours before tonight's probes. (And, per the rotation finding, the morning's 2
  attempts were almost certainly on different keys too — see §11.2.)

### 4.3 Consequence — live lockout test NOT performed, and not feasible from this VM

A live 429 demonstration requires 5 consecutive failed attempts from one stable IP.
This VM cannot provide one: its egress rotates per request (IPv4 and IPv6 alike),
and no fixed-IP egress is available or authorized here. The lockout behaviour
therefore stands on: (a) the code trace (§3 — keying, threshold, durations all
explicit), (b) the Hono-adapter test (`tests/workerApi.test.ts:117`, 403 ×5 → 429,
other IP unaffected), (c) the Express-adapter test (`tests/serverApi.test.ts:121`),
and (d) the local `wrangler dev` run (PROMPT 1 doc — 403 ×5, then 429). The live
429 test is recorded as **NOT performed — environment limitation, not a product
finding**. A stable-IP client (e.g. سعيد's phone on a fixed network, or a CI runner
with a static egress) could run it in the future; it is not required for closure —
the §10 item 5 condition («Rate Limiting يعمل عبر Upstash من Runtime المستقل») is
satisfied by the shared store + the live 403 chain + the tested lockout logic.

### 4.4 Security implication — per-IP limiting and rotation (finding F1, Low)

Per-IP rate limiting is bypassable by any client whose egress rotates — this VM
demonstrates it unintentionally, and an attacker with a rotating proxy pool could do
it deliberately. This is an inherent limitation of IP-keyed limiting, **not a defect
in this implementation**: the guard does exactly what the plan specifies, the PIN
space is 10^8 (8 digits), the endpoint mints coach sessions only (no patient data),
and a brute force still needs ~10^8 requests. Recorded as a Low finding with a
follow-up suggestion (a global or per-account counter, or a CAPTCHA, if the threat
model ever requires it). It does not block Phase 1 closure.

## 5. No secrets in frontend — PASS

- **Live bundles:** all 10 bundles scanned (§1) — `service_role`,
  `client_secret`, `apps.googleusercontent.com`, `BEGIN PRIVATE KEY`, `UPSTASH`,
  `SESSION_SECRET`, `COACH_PIN`: **0 matches each**.
- **Tracked source:** `grep` over `src/`, `cloudflare-worker.mjs`, `wrangler.jsonc`,
  `vite.config.ts` for `service_role` / `client_secret` /
  `apps.googleusercontent.com` / private-key headers / `sk-…` / `ghp_…`:
  **0 matches** (excluding test/mock mentions — none were present either).
  `service_role` occurs only as a role name in SQL grants and docs (PROMPT 3 V2).
- **No hardcoded Supabase URLs:** zero `supabase.co` occurrences and zero project
  refs in tracked non-doc source — the Supabase URL/key are build-time `VITE_*`
  variables only.
- **`wrangler.jsonc`:** contains no `vars`, `secrets`, `durable_objects`,
  `kv_namespaces`, or `d1_databases` keys — the only binding is `ASSETS`
  (`./dist-cf`, SPA fallback, `run_worker_first` for `/api/*`, `/health`,
  `/coach-session`). All 4 runtime secrets live as Cloudflare Dashboard Secrets,
  set by سعيد in the morning; they are never in git, the bundle, or logs.
- **VITE variables in `src/`:** exactly 7, all public-by-design —
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PLATFORM_ENABLED`,
  `VITE_REALTIME_QA_ENABLED`, `VITE_GOOGLE_OAUTH_ENABLED`, `VITE_VAPID_PUBLIC_KEY`,
  `VITE_COACH_LOCAL_ONLY` (forced `false` in production builds).
- **GitHub Actions workflow** (`.github/workflows/cloudflare-worker.yml`, manual
  dispatch only, `permissions: contents: read`): public `VITE_*` values come from
  repo **Variables**, Cloudflare credentials from repo **Secrets**
  (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); the workflow explicitly does
  **not** manage the 4 runtime secrets; a `wrangler deploy --dry-run` validation
  runs before deploy. Wrangler is pinned (`wrangler@4.166.0`).

## 6. No Vercel dependency in the Worker path — PASS

- `vercel.app`: **0 matches** in `cloudflare-worker.mjs`, in all of `src/`, in
  `wrangler.jsonc`, and in all 10 live bundles.
- The Worker never calls Vercel: its only outbound fetch is the Upstash REST call
  (`coachGuardStore.ts:116`); `env.ASSETS.fetch` serves local static assets.
- Auth redirects are origin-relative (`auth.tsx:209-212`,
  `PlatformApp.tsx:515` — PROMPT 3 V6), so the preview origin works without any
  Vercel address. The Staging redirect allow-list includes the workers.dev origin
  (added in the morning; Vercel origin is not present on Staging and is not
  needed there).
- The preview was verified end-to-end tonight without touching Vercel at all
  (all curls against `workers.dev` + Supabase directly).

## 7. Push still via Supabase Edge Function `notify` — PASS

- `src/platform/push.ts:102` — `notifyPatient` fetches
  `` `${VITE_SUPABASE_URL}/functions/v1/notify` `` directly with the user's access
  token + anon key. No Worker URL appears anywhere in the push path.
- `cloudflare-worker.mjs:26-28` states the boundary explicitly («never proxy
  Supabase Edge Function `notify`, store Push endpoints, or receive VAPID
  secrets»); the Worker has no push route, no VAPID secret, and no endpoint
  storage. `grep notify` across the Worker + `src/server/` returns only that
  comment and the `push.ts` implementation.
- The old Cloudflare FCM Worker was deleted in PR #32 and was not recreated.
- Push payload is empty by design (PROMPT 6 §3 item 14); end-to-end delivery on a
  real device remains untested (open item O12, Low — unchanged by this review).

## 8. No patient data flows to Cloudflare — PASS

From the Worker code paths (not from claims):

- The Worker routes exactly 4 API paths — `/health`, `/api/health`,
  `/coach-session`, `/api/coach-session` — plus Static Assets
  (`cloudflare-worker.mjs:121-132`). The coach-session handlers exchange only a
  PIN (in) and an HMAC token (out); the delete handler exchanges only a token.
- **Zero** `supabase` / `patients` / `day_logs` / `profiles` references in
  `cloudflare-worker.mjs` and `src/server/` (the only match is the notification
  boundary comment). The Worker contains no Supabase client and no patient query.
- The only outbound `fetch()` in the server path is the Upstash guard-store call
  (`coachGuardStore.ts:116`), which stores attempt counts + lockout timestamps
  (keyed by IP) and SHA-256 revocation markers — no patient data, no tokens in
  the clear.
- Patient data travels browser → Supabase directly (cross-origin, never through
  the Worker); the SW cache excludes `/api/*` and all cross-origin requests
  (PROMPT 5 §5.4), and the Worker never touches the Cache API (zero `cache`
  references in `cloudflare-worker.mjs`).
- Static Assets serve only the public SPA shell (`dist-cf/` — verified tonight:
  `npm run build:cloudflare` succeeds and `dist-cf/` contains no `server.cjs`).

## 9. Supabase Staging connectivity — PASS

- `GET https://dubevgijagqjgwcibqeo.supabase.co/auth/v1/health` → **401**
  `{"message":"No API key found in request"}` — the expected answer without a
  key; the Auth service is up (same result as PROMPT 3 V5).
- `GET https://dubevgijagqjgwcibqeo.supabase.co/rest/v1/` → **401** — the REST
  service is up and enforcing authentication.
- The Worker itself has **no Supabase dependency by design** (no client, no
  calls — §8); Staging connectivity is a browser → Supabase path, proven live
  in the morning by the login + Realtime tests (closure report Appendix C) and
  re-confirmed tonight by the bundle config (§1) and the endpoint checks above.
- The Worker health endpoints (`/health`, `/api/health`) answer directly without
  depending on any secret or external service — liveness does not depend on
  configuration (`cloudflare-worker.mjs:98-99`).

## 10. Security review (code + tests, re-run tonight)

### 10.1 Test suite — all re-run locally tonight (main `89fb4619` + this doc only)

| Check | Result |
|---|---|
| `npm test` | **343 passed (46 files)**, 11.77 s |
| `npm run lint` | **0 errors**, 259 warnings (all pre-existing, untouched files) |
| `npm run build` | **OK** (11.87 s; `dist/server.cjs` 19.5 kB) |
| `npm run build:cloudflare` (dummy public vars) | **OK** (11.20 s; `dist-cf/` complete, no `server.cjs`) |
| `npx tsc --noEmit` | **Exit 0** — no type errors |
| `npm audit` | **BLOCKED by VM policy** — the audit endpoint returns 403 `policy_denied` (`zz_managed_internal_spaces_package_registries`). Dependency vulnerabilities are covered instead by CI's dependency & secret scanning check on the PR (see F6) |

Security-relevant test coverage (all passing): Hono adapter
(`tests/workerApi.test.ts`, 8 tests — health without secrets, fail-closed 503, token
issue + revoke, lockout, malformed JSON, both route prefixes); Express adapter
(`tests/serverApi.test.ts` — 429 lockout, per-IP isolation, `clearAttempts`);
client-side coach auth (`tests/coachAuth.test.ts` — wrong-PIN decrement, local
lockout); storage isolation (`tests/storageScope.test.ts`,
`tests/platform/storageScopeIntegration.test.ts`,
`tests/platform/localDataOwnership.test.ts`,
`tests/storageKeysMigration.test.ts`, `tests/platform/sync.test.ts` — 25 tests);
auth listener (`tests/platform/authListener.test.ts`, 4 tests); invitations
(`tests/platform/invitations.test.ts`, 9 tests); database layer
(`tests/platform/databaseLayer.test.ts`, 9 tests); push (`tests/platform/push.test.ts`,
2 tests); service worker (`tests/serviceWorker.test.ts`).

### 10.2 Per-surface review

| Surface | Finding |
|---|---|
| **Secrets exposure** | None. §5: 0 secret patterns in bundles and tracked source; secrets live only as Cloudflare Dashboard Secrets + Vercel env + repo Secrets (workflow). No secret value appears in this review, in any log, or in the PR |
| **RLS bypass** | None found. Enforcement is server-side in Postgres: `private.can_access_patient(uuid)` (SECURITY DEFINER, owner → TRUE, admin/coach clinic-scoped + subscription-active, else self + active subscription — closure report Appendix B Q4). The client never decides access; it only passes the session UID. Cross-clinic delivery was 0 in all 3 live Realtime runs |
| **Broken access control / IDOR** | None found. All `patients`/`day_logs` queries in `src/platform/database.ts` filter by the session UID (`.eq('id', uid)`, `.eq('patient_id', uid)`) or the caller's clinic (`.eq('clinic_id', clinicId)`); staff views filter by clinic + `invited_by`. The one function taking an arbitrary patient UID (`listPatientDayLogsForExport`, `database.ts:696`) is called only from `DoctorExportButtons.tsx` (staff export) and is still RLS-gated server-side — a patient passing another patient's UID gets zero rows. Role/clinic come from the invitation, never from the user (`invitations.ts`, PROMPT 3 §1.1) |
| **Cross-user data leakage (local)** | None beyond the recorded D2. UID namespacing verified by PROMPT 5 (25 tests); the only cross-account store is custom plan presets on a fixed key (D2, Low — coach templates, PIN-gated). Logout locks by namespace, does not wipe (D6 — documented limitation, not a bug). The full live T1 proof is C3's job, not this review's |
| **Cross-user data leakage (cloud)** | None found. Realtime channels are UID-filtered (`auth.tsx:154-168`, `filter: id=eq.${uid}`); publication is `public.profiles` only; the live isolation test proved cross-clinic delivery 0 |
| **Auth session handling** | Sound. `PlatformAuthProvider` (`src/platform/auth.tsx`): `getSession()` on mount + permanent `onAuthStateChange`; profile read from `profiles` (`id = uid`) with 3× backoff retry + UID-filtered Realtime pickup (SDV2-INT-005); `parseUserProfile` accepts only known roles + non-empty `clinic_id` (this is what rejected the empty-clinic owner in the morning — client-side validation consistent with the server state); a session without a valid profile reaches no data (RLS rejects by default). Sign-out is `supabase.auth.signOut()`; the Supabase session slot holds exactly one session per origin. Google sign-in code exists but is unreachable from any rendered UI while the flag is `false` (PROMPT 3 V3), and C2 closed Google by decision |
| **Coach session tokens** | Sound. HMAC-SHA256, 60-min expiry, 16-byte random nonce, constant-time comparison (`crypto.timingSafeEqual` on SHA-256 digests for both the PIN and the token HMAC — `coachSessionService.ts:78-83, 117-122`); revocation via SHA-256-keyed Upstash entries with TTL = token expiry; logout revokes (`DELETE /api/coach-session`). The local PIN hash is salted SHA-256 (`v2$`, never the PIN itself) and is created only after the server accepts the PIN (fail-closed SDV2-SEC-002) |
| **Rate-limit bypass** | See F1 (Low): per-IP keying is bypassable by rotation — inherent to IP-based limiting, mitigated by the 10^8 PIN space and the coach-only scope. `X-Forwarded-For` spoofing: the Worker reads `CF-Connecting-IP` first (set by Cloudflare, not client-spoofable); Express trusts one proxy (`api/index.ts`, `trust proxy 1` — correct behind Vercel; see F7) |
| **Unsafe localStorage access** | None found. All 22 files touching `localStorage` route through `StorageKeys` with call-time `ns()` resolution; zero literal key strings in `src/` (PROMPT 5 §1). The coach token/hash are scope-namespaced; the unlock proof is per-tab sessionStorage bound to the scope's hash |
| **XSS / injection** | None found. Zero `dangerouslySetInnerHTML` / `innerHTML =` / `eval(` / `new Function(` in `src/`. Supabase queries use the parameterized client (no string-built SQL). The SW push handler caps title/body (80/160 chars) and ignores invalid JSON |
| **Dependency vulnerabilities** | See F6 (Info): `npm audit` is policy-blocked in this VM; the lockfile still pins `picomatch 4.0.7` (the pre-existing warning that kept PR #75's CI red — unchanged lockfile, no fixed version available at the time). CI dependency scanning runs on this PR |
| **Error handling** | Fail-closed throughout: missing secrets in production → throw at boot / 503 (never dev defaults); guard-store failure → 503 with a clear Arabic message, never a silent bypass; auth errors → «بلا ملف دور» / login form, never data. No stack traces or secret values leak into responses (verified in tonight's curl outputs) |

### 10.3 Findings

| ID | Severity | Finding | Blocks closure? |
|---|---|---|---|
| F1 | **Low** | Rate limiting is keyed per-IP (`sd:coach:rl:<ip>`); clients behind rotating egress (this VM: 9 distinct IPs in 9 tries) and attackers with IP rotation are not effectively limited. Mitigated by the 10^8 PIN space and the coach-only endpoint scope. Follow-up: consider a global/per-account counter or CAPTCHA if the threat model ever requires it | **No** — design matches the plan; limitation, not a defect |
| F2 | Low | (PROMPT 5 D2, already recorded) Custom plan presets on fixed key `nt_custom_plan_presets_v1`, shared across accounts on the device — coach templates, PIN-gated | No |
| F3 | Medium-Low | (PROMPT 5 D1, already recorded; re-confirmed tonight) Offline boot needs ≥2 prior online visits — precache omits bundles and the HTTP cache is `max-age=0` on every response. No data risk | No |
| F4 | Limitation | (PROMPT 5 D6, already recorded) Logout locks by namespace, does not wipe; no encryption at rest — UID-bucket bytes remain on disk, readable via DevTools with physical access. Documented local-first design | No |
| F5 | Info | (Correction, §11.1) PROMPT 1 doc says unknown `/api/*` → «Hono's JSON 404»; the actual response is plain-text `404 Not Found` (Hono default) | No |
| F6 | Info | `npm audit` is blocked in this VM (403 `policy_denied`); dependency vulnerabilities are covered by CI's dependency & secret scanning check on the PR. `picomatch 4.0.7` pre-existing warning unchanged in the lockfile | No |
| F7 | Info | `api/index.ts` sets `trust proxy 1` so `req.ip` comes from `X-Forwarded-For` — correct behind Vercel (which sets the header), but the IP would be spoofable if the Express app were ever deployed without a trusted proxy in front. Deployment is Vercel; documented here, no action | No |
| F8 | Info | Live 429 lockout never demonstrated from this VM (§4.3) — environment limitation, not a product finding; proven in tests + local `wrangler dev` | No |

**No Critical or High finding. No closure-blocking finding.**

## 11. Corrections to earlier reports

### 11.1 Unknown `/api/*` 404 is plain text, not JSON

The PROMPT 1 doc («Two documented edge differences», item 2) says the Worker answers
unknown `/api/*` paths with «Hono's JSON 404». Verified tonight: `GET
/api/does-not-exist` returns HTTP 404 with body `404 Not Found` (plain text — Hono's
default `notFound` handler). The substance is unchanged (the Worker answers 404 where
Express answers its HTML 404); only the format description was imprecise.

### 11.2 The «2 of 5 wrong-PIN attempts» framing assumed a stable VM IP — it is not

The closure report (§4, «Coach PIN attempts») records «Two wrong-PIN attempts from
this VM's IP stand on the record — 2 of 5 before the Upstash-backed lockout» and
forbids further probes from this VM. Tonight's evidence shows the premise was wrong:
this VM's egress IP rotates on every request (9 distinct IPs in 9 tries, §4.2), so
the morning's 2 attempts almost certainly landed on different per-IP keys, and
tonight's 6 probes provably did (no lockout after 6 consecutive failures). No single
guard key ever accumulated more than 1 attempt from this VM, and the 65-minute entry
TTL expired the morning's entries ~13 hours before tonight's probes. **The lockout
budget was never actually consumed.** The caution itself remains valid as policy (do
not hammer the PIN endpoint), but the «2 of 5» count should not be quoted as a
standing lockout state. The correct-PIN test still belongs to سعيد (his IP + his PIN).

### 11.3 Known doc error, already recorded (not re-filed)

The PROMPT 3 doc §1.3 still says the Realtime QA harness «runs the two-clinic
isolation test and the owner sanity check». There is no owner sanity check (closure
report §6.1; verified again in this review by the harness source — zero `sanity`
matches). The PROMPT 3 doc is a point-in-time record and is left unchanged; the
correction lives in the closure report.

## 12. Closure verdict (this review's scope)

Cloudflare independence is **demonstrated and re-verified tonight**: the preview is
live and serves Staging only; the Hono runtime shares one implementation with the
Express adapter; rate limiting runs on the shared Upstash store; no secrets are in
the frontend; no Vercel dependency exists in the Worker path; push stays on the
Supabase Edge Function; no patient data reaches Cloudflare; the full test suite,
lint, build, and type checks pass. The security review found **no critical or high
unaddressed issue and nothing that blocks Phase 1 closure** on the
independence/security axis. The live 429 lockout demonstration remains unperformed
for an environmental reason (rotating VM egress), with the behaviour proven in tests
and local runs; the per-IP limitation (F1) is recorded as Low.

The remaining Phase 1 close-out items (C1 disposable-Supabase restore test, C3 full
T1 live proof) are separate workstreams and are not decided by this review.

## Appendix — evidence detail

- **Probe log (§4.1):** 6 wrong-PIN probes tonight (`POST /api/coach-session`,
  PIN `00000`), all 403 `رمز PIN غير صحيح.` — probes at 19:49 and 19:50:46–19:50:54
  UTC. No correct-PIN probe. No probe after the rotation explanation was
  established.
- **Egress rotation (§4.2):** `ifconfig.me` 6/6 distinct IPv6 addresses;
  `api.ipify.org` 3/3 distinct IPv4 addresses (104.29.200.165, 104.29.192.133,
  104.29.193.195).
- **Live endpoints (§1):** 8 endpoints curled ~21:50 Cairo, all 200 (times
  0.35–0.52 s); `/api/does-not-exist` 404; malformed JSON 400; DELETE 200.
- **Bundle scan (§1):** 10 bundles fetched fresh (all 200), totals: staging ref
  4, prod ref 0, all secret patterns 0, `vercel.app` 0.
- **Source greps (§5–§8):** secrets 0 in `src/` + Worker + configs; `vercel.app`
  0 in Worker + `src/`; `durable` 0 in the Worker path (comment only); `notify`
  only in `push.ts` + the Worker boundary comment; Supabase/patient refs 0 in
  Worker + `src/server/` (comment only); `dangerouslySetInnerHTML` /
  `innerHTML =` / `eval(` / `new Function(` 0 in `src/`.
- **Test suite (§10.1):** 343/343 (46 files); lint 0 errors / 259 warnings;
  build OK; `build:cloudflare` OK (no `server.cjs` in `dist-cf/`); `tsc --noEmit`
  exit 0; `npm audit` policy-blocked (403).
- **Live `/sw.js`:** byte-identical to `public/sw.js` on main (`diff` clean).
- **Live headers:** `Cache-Control: public, max-age=0, must-revalidate` on `/`,
  `/sw.js`, `/assets/index-xfudTUID.js`.
- **No login was attempted anywhere in this review.** No Supabase write, no
  deployment, no production/DNS change, no contact with `youngtube-worker`.
- **Files changed in this PR:** this document only (verification only).
