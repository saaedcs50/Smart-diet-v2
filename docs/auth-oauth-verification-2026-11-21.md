# Auth + Google OAuth Verification — Cloudflare Preview (PROMPT 3)

**Date:** 2026-11-21 ~07:50 Cairo · **Preview:** https://smart-diet-v2.saaedbelal.workers.dev
(Staging only) · **main HEAD at time of writing:** `7ca8cd78` (PR #80 merged)
· **Scope:** verification only — no auth/OAuth configuration was changed anywhere.

> **Status update (21 Nov 2026, evening):** the Google OAuth OPEN item recorded here
> (§3) was closed by an explicit product-owner decision — Google OAuth stays disabled
> for now; Email/Password is the approved auth method. See
> `docs/phase-1-final-closure-report.md` §7 decision 5. This document is otherwise
> unchanged as the point-in-time verification record of the morning of 21 Nov.

## Verdict

| Question | Verdict |
|---|---|
| Does email/password auth have a real, working entry point on the preview? | **Yes in code; live login NOT yet demonstrated** (needs the 3 staging passwords, held by the user) |
| Is Google OAuth safely disabled on the preview? | **Yes — proven at code, bundle, and browser level** |
| Is Google OAuth *working* on the preview? | **No — disabled by design; recorded as OPEN for PROMPT 6** |
| Are auth secrets (service_role, OAuth client secret) reachable from the frontend? | **No — verified in git and in all 10 live bundles** |
| Does the preview talk to Staging Supabase only? | **Yes — staging ref present, production ref absent (0 matches)** |
| Does the coach PIN API work on the preview? | **Yes — wrong PIN returns 403 (was 503); all 4 Worker secrets are set** |

Plan §10 item 9 («المصادقة بالبريد وGoogle تعمل على نطاق الاختبار») is
therefore **partially satisfied**: email auth is implemented and staged but
not yet live-tested; Google auth is deliberately disabled and stays OPEN
per the plan's PROMPT 6 rule (works if the provider is enabled, otherwise
remains safely disabled and is recorded as open).

## 1. Auth flow map — three separate mechanisms

The single most important finding: **the app has three independent auth
mechanisms, and they must not be confused with each other.**

### 1.1 Supabase Auth — platform accounts (the real multi-user auth)

This is the only mechanism that authenticates patients, doctors, admins,
and the platform owner against Supabase. There is **no `/login` route**:
the sign-in form lives *inside* `/platform` and renders whenever there is
no session (see §1.4).

| Route / surface | What happens | Code |
|---|---|---|
| `/platform` (no session) | `LoginForm`: email + password → `signInWithPassword`; «نسيت كلمة المرور؟» → `resetPasswordForEmail` with `redirectTo: {origin}/platform/update-password`; «تسجيل بدعوة» → `/platform/register`; Google button **only if** `VITE_GOOGLE_OAUTH_ENABLED=true` | `src/platform/PlatformApp.tsx:482-602` |
| `/platform/register` | Invitation-only registration: `registerWithInvitation` → `signUp` → profile created from the invitation (role + clinic come from the invitation, never from the user) → invitation consumed; patient role also gets a `patients` row. Staff Google registration button, same flag gate; patient invitations via Google are rejected in code | `src/platform/PlatformApp.tsx:707-791`, `src/platform/invitations.ts:203-291` |
| `/platform/update-password` | Password-reset completion: `updateUser({ password })` (min 8 chars, confirmation must match); without a valid session it shows «رابط الاستعادة غير صالح» | `src/platform/PlatformApp.tsx:605-680` |
| `/platform` (with session) | Role routing: `patient` → own `PatientDetail` (cannot view another patient's file — enforced in UI *and* RLS); `coach`/`admin` → staff dashboard; `owner` → redirected to `/owner`; `disabled` → «حسابك موقوف»; session without a valid `profiles` row → «حسابك بلا ملف دور» | `src/platform/PlatformApp.tsx:2004-2156` |
| `/owner` | `OwnerApp`: same auth provider, `owner` role only. No login form here — unauthenticated visitors get a link to `/platform` to sign in | `src/platform/owner/OwnerApp.tsx:30-60` |
| `/realtime-qa` | Test harness only (see §1.3) | `src/platform/realtime-qa.tsx` |

**Session handling** — `PlatformAuthProvider` (`src/platform/auth.tsx`):
`getSession()` on mount, then a permanent `onAuthStateChange` subscription.
On every session, the role/clinic profile is read from `profiles`
(`id = auth.uid()`); a missing profile is retried 3× with backoff and then
tracked via a UID-filtered Realtime channel on `public.profiles`, so a
profile created *after* the sign-in event is picked up without a reload
(SDV2-INT-005). A user with a session but no valid profile has no role and
reaches no data — RLS rejects them by default. Sign-out is
`supabase.auth.signOut()` (header «خروج» buttons in `PlatformApp` and
`OwnerApp`).

**Account creation is invitation-only.** There is no self-registration:
a clinic admin creates invitations (`InviteForm` → `createInvitation`),
and registration requires the exact invited email. Google sign-in is
staff-only by recorded decision — enforced at account creation (a patient
invitation via Google is refused), not at the sign-in button.

**Supabase client** — `src/platform/supabase.ts`: single client from
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public by design; RLS
enforces access). No `service_role` anywhere in the frontend.

**Local-data scoping** — `src/main.tsx` resolves the local-storage
namespace from the persisted Supabase session UID *before* React renders,
and keeps it aligned on every auth-state change (login/logout/account
switch). This is the PRIV-001 mechanism PROMPT 5 verifies.

### 1.2 Coach PIN — single-clinic legacy mode (NOT Supabase Auth)

The `/coach` PIN screen is a **separate, older mechanism** for the
single-clinic app. It never touches Supabase Auth, and a coach-PIN unlock
does not create a platform session (and vice versa).

Flow (`src/components/coach/CoachPinGate.tsx`, `src/components/PinModal.tsx`,
`src/App.tsx:165`, `src/utils/coachAuth.ts`, `src/utils/coachServer.ts`):

1. **Server first.** The PIN is checked against `POST /api/coach-session`
   (Hono on the Cloudflare preview, Express on Vercel; shared logic in
   `src/server/coachSessionService.ts`). Success returns a 60-minute HMAC
   token, saved in `localStorage` (`coachSessionToken`); logout revokes it
   via `DELETE /api/coach-session`. Rate limiting is server-side on the
   shared Upstash store (5 wrong attempts → lockout).
2. **First use on a device.** Only after the server accepts the PIN is a
   salted local hash (`v2$`, `localStorage`) created; later unlocks verify
   against the local hash (`unlockCoachSession`) with local rate limiting
   (5 attempts → 5-minute lockout). The unlock proof lives in
   `sessionStorage` (cleared when the tab closes).
3. **Fail-closed (SDV2-SEC-002).** If the server is unreachable, no local
   PIN is created — unless `VITE_COACH_LOCAL_ONLY=true` **and** a dev
   build. In production/preview builds the flag is forced `false`, so an
   unreachable API can never mint a local PIN for a new visitor.

This explains the browser finding «first-use local PIN creation» on
`/coach`: on a fresh device the screen offers PIN setup, but setup itself
is server-gated. The header «الإعدادات» (Settings) button opening `/coach`
is a misleading label (already noted in PROMPT 1 browser verification).

**Live status (07:46, verified by this prompt):** `POST /api/coach-session`
with a wrong PIN returns **403 `رمز PIN غير صحيح.`** — previously 503.
That proves the full chain: boot validation passed (COACH_PIN +
SESSION_SECRET present) *and* the Upstash guard store is reachable.
All 4 Worker secrets are therefore set (سعيد completed the Upstash fix
~07:47). A correct-PIN 200 was **not** tested — the real PIN is his.

### 1.3 Realtime QA harness — test-only Supabase Auth

`/realtime-qa` (`src/platform/realtime-qa.tsx`, gated by
`VITE_REALTIME_QA_ENABLED=true`, preview-only) creates three separate
Supabase clients and signs in `patienta@staging.test`,
`patientb@staging.test`, and `owner@staging.test` with
`signInWithPassword`, runs the two-clinic isolation test and the owner
sanity check, then signs all three out. It is a test harness, not a
product login surface.

### 1.4 The `/login` finding — resolved, not a bug

PROMPT 1 browser verification found that `/login`, `/signin`, and `/auth`
all serve the client dashboard with no sign-in form. Code inspection
confirms why: **`App.tsx` defines no such routes.** Routing is a
`window.location.pathname` prefix switch (`src/App.tsx:331-360`):

- `/platform*` → `PlatformApp` (only if `VITE_PLATFORM_ENABLED=true`)
- `/owner*` → `OwnerApp` (same gate)
- `/coach*` → coach PIN screen
- `/prototype*` → prototype
- **everything else → the client dashboard** (including `/login`)

`/login` returns HTTP 200 only because the SPA fallback serves
`index.html` for any unknown path. The email/password sign-in lives
*inside* `/platform` (`LoginForm` renders when `!user`). Consequences:

- The PROMPT 3 login test must target **`/platform`**, never `/login`.
- There is no missing login page to build — this is the intended design.
- `/platform` sub-routes are parsed inside `PlatformApp`
  (`parseRoute`, `PlatformApp.tsx:84-97`): `login` (default),
  `register`, `update-password`, `dashboard`, `patient/:uid`.

## 2. Verification (curl + code + live bundles, 2026-11-21 ~07:46)

No login was attempted anywhere — the 3 staging passwords are held by
the user and are not available to this prompt.

| # | Check | Result | Evidence |
|---|---|---|---|
| V1 | Preview serves Staging Supabase config | **PASS** | Live bundle env block: `VITE_SUPABASE_URL: "https://dubevgijagqjgwcibqeo.supabase.co"`; anon JWT decodes to `ref: dubevgijagqjgwcibqeo`, `role: anon`. Staging ref occurrences: main bundle 2, auth chunks 1, realtime-qa chunk 1. Production ref `lhjyshlxbsnesayivxpb`: **0 in all 10 fetched bundles** |
| V2 | No auth secret reachable from the frontend | **PASS** | `service_role` / `client_secret` / `apps.googleusercontent.com`: **0 matches** in all 10 live bundles (`index-*`, `vendor-*`, `PlatformApp-*`, `OwnerApp-*`, `auth-*`, `index-CGc*`, `realtimeQa-*`) and **0 values** in tracked source (`git grep` — `service_role` appears only as a role name in SQL grants and docs, never as a key). Only 7 `VITE_*` variables exist in `src/`, all public-by-design |
| V3 | Google sign-in button absent on the preview | **PASS** (3 levels) | Browser (PROMPT 1): button absent on PIN screen and home. Code: both buttons are `{isGoogleOAuthEnabled() && (...)}` (`PlatformApp.tsx:583,778`); flag is `VITE_GOOGLE_OAUTH_ENABLED === 'true'` (`auth.tsx:31`). Bundle: flag inlined as `"false"`; the button strings («دخول Google — للطاقم»، «إنشاء حساب طاقم عبر Google») are **absent from the built chunk** — esbuild tree-shook the gated JSX away. The `signInWithOAuth` code paths still exist in the bundle but are unreachable from any rendered UI |
| V4 | Auth routes serve on the preview | **PASS** | `GET /platform`, `/platform/register`, `/platform/update-password`, `/owner`, `/coach` → all **200**. `/login` → 200 via SPA fallback (not a route — see §1.4) |
| V5 | Staging Auth endpoint live | **PASS** | `GET https://dubevgijagqjgwcibqeo.supabase.co/auth/v1/health` → 401 `{"message":"No API key found in request"}` — the expected answer without a key; the endpoint is up |
| V6 | OAuth / reset redirects are origin-relative | **PASS** | Code + bundle: `signInWithOAuth({provider:'google', options:{redirectTo: window.location.origin + '/platform'}})` (`auth.tsx:209-212`, `invitations.ts:254-257`); reset: `` `${window.location.origin}/platform/update-password` `` (`PlatformApp.tsx:515`). No hardcoded Vercel URL anywhere in the auth flow — the preview origin works as soon as it is allow-listed (handoff B1) |
| V7 | Coach PIN API live on the preview | **PASS** | `POST /api/coach-session` wrong PIN → **403** `رمز PIN غير صحيح.` (was 503 before the secrets were set). One wrong-PIN attempt made by this prompt (1 of 5 before lockout; no lockout triggered). Correct-PIN 200 not tested — real PIN is the user's |

### Minor finding (cosmetic, no fix in this task)

`RegisterForm` renders the explanatory sentence «دعوات المرضى بالبريد
وكلمة المرور فقط — زر Google للطاقم فقط» **unconditionally**
(`PlatformApp.tsx:786-789`), while the Google button it refers to is
gated and absent. On the preview the register page therefore mentions a
button that does not exist. Suggest gating the sentence with the same
flag (or rewording it) in a later cleanup — not a security or
correctness issue.

## 3. Google OAuth status — DISABLED by design, OPEN

| Layer | State | Source |
|---|---|---|
| Supabase provider (both projects) | **Disabled** per the 17 Nov audit; no change recorded since | followup doc §1, row «Auth redirect / Google OAuth» |
| Production redirect allow-list | **Vercel-only** per the 17 Nov audit | followup doc §1 |
| Staging redirect allow-list | **Unknown — needs Dashboard check** (handoff B1) | — |
| Dedicated Google OAuth client | **Created** (without changing the Firebase client), but its Supabase provider credentials/configuration and a non-Vercel callback are **unverified**; no client ID or secret exists anywhere in the repo | followup doc §1 + §3 gate 2 |
| Preview build flag | `VITE_GOOGLE_OAUTH_ENABLED=false` (inlined in the live bundle) | §2 V3 |
| `.env.example` default | `false`, with the comment «فعّل أزرار Google فقط بعد إعداد Provider وCallback في Supabase وGoogle Cloud. القيمة الافتراضية الآمنة false لأن Google OAuth غير مفعّل في المشاريع الحالية» | `.env.example` |
| Button gating | Added in PR #77 (`e7f34de` «fix(auth): gate inactive Google OAuth») | git log |

**Status for PROMPT 6: OPEN.** Per the plan's rule, Google OAuth stays
safely disabled and is recorded as open — it is *not* claimed working.
Enabling it later (not part of this prompt) requires, in order:
(1) install the dedicated client's credentials in Supabase Auth →
Sign In / Providers → Google on the **staging** project first;
(2) add `https://smart-diet-v2.saaedbelal.workers.dev/platform` to the
staging redirect allow-list **without removing the Vercel origin**;
(3) add the Supabase callback URL to the Google Cloud client;
(4) rebuild the preview with `VITE_GOOGLE_OAUTH_ENABLED=true`;
(5) test staff Google sign-in. Do **not** reuse the Firebase OAuth client.

## 4. Handoff list — parent / user

### A. Browser login tests (user enters the 3 staging passwords — never in chat)

Run on https://smart-diet-v2.saaedbelal.workers.dev (combine with the
PROMPT 2 Realtime session — same passwords):

1. `/platform` + `patienta@staging.test` → patient dashboard shows only
   Patient A's data.
2. Sign out («خروج») → `LoginForm` returns. Reload the page → session
   restored (or login again). Sign in as `patientb@staging.test` →
   cannot see Patient A's file (UI + RLS).
3. `owner@staging.test` → redirected to `/owner` (owner dashboard).
4. `/platform/register` — needs a fresh invitation created by an admin
   first; if none is available, record registration as untested.
5. Password reset («نسيت كلمة المرور؟») — the reset email goes to a
   `staging.test` address, which likely cannot receive mail; record as
   blocked/untestable unless a real mailbox is used for a test account.
6. `/coach` + the real PIN → coach session unlocks (correct-PIN 200;
   wrong PIN already verified 403).

### B. Supabase Dashboard checks (parent, via the Dashboard in the browser)

Staging project `dubevgijagqjgwcibqeo` (read-only unless stated):

1. **Authentication → URL Configuration:** record Site URL and the
   Redirect URLs list. Is `https://smart-diet-v2.saaedbelal.workers.dev/**`
   present? (Needed for the OAuth callback and the password-reset
   redirect — email/password sign-in itself does not need it.)
   If missing, **add the preview origin; do NOT remove the Vercel origin.**
2. **Authentication → Sign In / Providers → Google:** record enabled?
   Client ID present? (Expected: disabled. Do NOT enable without his
   go-ahead.)
3. **Authentication → Users:** do `patienta@`, `patientb@`, and
   `owner@staging.test` exist? (PROMPT 2 dependency — confirms the
   accounts exist before he types passwords.)
4. Production project `lhjyshlxbsnesayivxpb`, URL Configuration
   (read-only, for the record): still Vercel-only?

### C. User decisions

1. Enter the 3 staging passwords in the browser tests above.
2. Decide: enable Google OAuth on staging (requires his Google Cloud
   client credentials installed in Supabase) or keep it disabled —
   PROMPT 6 records it OPEN either way.
3. Confirm the real coach PIN unlocks `/coach` on the preview.

## 5. Open items for PROMPT 6

1. Live email sign-in / sign-out / session-restore on the preview —
   pending handoff A.
2. Google OAuth end-to-end — OPEN by design (§3); cannot be tested
   until the provider is enabled.
3. Staging redirect allow-list state — pending handoff B1.
4. Invitation registration + password-reset email flow — likely
   untestable without a real mailbox (handoff A4/A5).
5. Cosmetic: gate the RegisterForm Google sentence with the OAuth flag
   (§2 minor finding).

## Appendix — evidence detail

- Bundles fetched 2026-11-21 ~07:46 from the live preview and scanned:
  `index-xfudTUID.js`, `index-Dt17Hx_T.js`, `vendor-react-DqoksqUc.js`,
  `vendor-motion-pW_eTOeE.js`, `vendor-pdf-FxkBMPp-.js`,
  `PlatformApp-Ddi3eQuB.js`, `OwnerApp-DNqpHHAb.js`,
  `auth-Bot04il5.js`, `index-CGc_CKmv.js`, `realtimeQa-mCPkV6PN.js`.
  Secret patterns (`service_role`, `client_secret`,
  `apps.googleusercontent.com`): 0 matches in all 10.
  Production ref `lhjyshlxbsnesayivxpb`: 0 matches in all 10.
  Staging ref `dubevgijagqjgwcibqeo`: 2 (main) + 1 (auth chunks) + 1
  (realtime-qa chunk).
- Bundle env block (values verified, keys not reproduced here):
  `VITE_SUPABASE_URL` = staging URL; `VITE_SUPABASE_ANON_KEY` = staging
  anon JWT (`ref: dubevgijagqjgwcibqeo`, `role: anon`);
  `VITE_PLATFORM_ENABLED: "true"`; `VITE_REALTIME_QA_ENABLED: "true"`;
  `VITE_GOOGLE_OAUTH_ENABLED: "false"`.
- `git grep` on tracked source: no `service_role` / `client_secret` /
  `apps.googleusercontent.com` values; `service_role` occurs only as a
  role name in SQL grants and documentation.
- Tests covering the auth provider statically:
  `tests/platform/authListener.test.ts` (4 tests — profile listener,
  unsubscribe, missing-profile semantics); no test renders the login
  form (no React render harness in this repo — live browser testing is
  the proof, per the test file's own header comment).
