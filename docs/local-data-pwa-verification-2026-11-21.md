# Local Data Ownership + PWA Isolation Verification (PROMPT 5)

**Date:** 2026-11-21 ~07:55 Cairo · **Preview:** https://smart-diet-v2.saaedbelal.workers.dev
(Staging only) · **main HEAD at time of writing:** `8f017122` (PR #81 merged)
· **Scope:** verification only — no code or configuration was changed in this
prompt. Every defect below is documented with severity and fix location; none
was fixed.

Plan references: implementation plan §3.4 (PWA / Service Worker), §3.5
(PRIV-001, 8 steps), §10 items 11–12. PROMPT 3 doc
(`docs/auth-oauth-verification-2026-11-21.md`) for the auth map this
verification builds on.

## Verdict summary

### PRIV-001 — 8 steps (§3.5)

| Step | Verdict | One line |
|---|---|---|
| 1. Inventory localStorage keys + IndexedDB stores | **PASS** | Full inventory in §1 — 24 namespaced localStorage keys, 1 per-scope IndexedDB, 1 sessionStorage key, 6 fixed keys (+ legacy migration sources) |
| 2. Classify public vs per-user data | **PASS** | Classification in §2 |
| 3. Namespace per-user data by Supabase UID | **PASS** (1 low gap) | All patient data is UID-namespaced; one gap: custom plan presets on a fixed key (D2, low) |
| 4. Logout blocks the next account from the previous account's data | **PASS in code; live proof OPEN** | Scope switches to `guest`/`local` + in-memory state cleared + binding gate; browser test T2 still needed |
| 5. Account switch loads ONLY the new account's store | **PASS in code; live proof OPEN** | Scope switch + full App state reload from the new scope; browser test T1 still needed |
| 6. Session-end wipe/lock strategy for private data | **PASS as LOCK** | Strategy is namespace lock, not wipe (D6 records the limitation: data stays on disk, in-app isolation only) |
| 7. No silent deletion of unsynced local data | **PASS** | No code path deletes user data on logout, sync, or migration; copies never delete the source |
| 8. Two-account test on one browser/device, both directions | **OPEN** | Needs 2 real accounts + passwords; exact procedure in §9 (T1) |

### §3.4 — PWA / Service Worker (7 items)

| Item | Verdict | One line |
|---|---|---|
| 1. Manifest, SW, start URL, scope review | **PASS** (notes) | Manifest complete; start_url `/`; SW scope `/`; registered on boot for all routes; SVG-only icons (D4) |
| 2. No private patient responses in cache | **PASS** | Fetch handler skips `/rest/`, `/auth/`, `/functions/`, `/api/`, all non-GET, all cross-origin (Supabase) |
| 3. Only appropriate static assets in precache | **PASS** | Precache is 4 shell files only (`/`, `/index.html`, `/manifest.json`, `/icon.svg`) |
| 4. Offline navigation fallback shows no previous user's data | **PASS** (data); boot reliability **MEDIUM-LOW RISK** | Fallback serves the public shell only; offline *boot* depends on the SW runtime cache, not the HTTP cache (§6) |
| 5. Account switch / logout clears related data | **PASS in code; live proof OPEN** | Same mechanism as PRIV-001 steps 4–5; browser tests T1/T2 still needed |
| 6. New API is not cached stale or cross-user | **PASS** | `/api/*` excluded from the SW cache; coach-session is POST (non-GET skipped); the Cloudflare Worker touches no Cache API |
| 7. One focused browser test (install / load / navigate / logout) | **OPEN** | Exact procedures in §9 (T1–T6) |

### Plan §10 closure items

| Item | Verdict |
|---|---|
| 11. «البيانات المحلية معزولة حسب UID ولا تظهر بعد تبديل الحساب» | **Isolation mechanism verified in code; live two-account proof still OPEN** (T1) |
| 12. «PWA لا يعرض Cache خاصًا بحساب سابق» | **PASS in code** — the SW cache holds no per-account content at all (shell + static assets only); live proof via T3 |

**Bottom line:** the UID isolation mechanism is real, thorough, and
fail-closed — it is not a paper design. The remaining gap is *proof*, not
*mechanism*: no two-account browser test has ever run (passwords were never
available), and offline boot relies on the SW runtime cache because the
HTTP cache cannot serve the bundle offline (`max-age=0` on every response).
One genuine low-severity gap (un-namespaced custom presets, D2) and one
medium-low offline-reliability risk (D1) are documented for PROMPT 6.

## 1. Inventory — every browser store (PRIV-001 step 1)

Key pattern: `sd_<brand-slug>_<scope-prefix><suffix>`, where the scope
prefix is `` (local), `guest_` (guest), or `user_<uid>_` (authenticated
user). `brand-slug` comes from `BRAND.shortName` (`src/utils/storageKeys.ts:17-20`,
`src/utils/storageScope.ts:44-49`).

### 1.1 localStorage — scope-namespaced keys (all via `StorageKeys`, `src/utils/storageKeys.ts:40-72`)

| Key suffix | Content | Classification |
|---|---|---|
| `plan` | Full plan config: client name, weight/waist targets, meals, supplements, symptoms list, score weights | Per-user health |
| `day_YYYY-MM-DD` | Day logs: meals, water, sleep, weight, measurements, symptoms, mood, medications, notes | Per-user health |
| `active_fasting` | Active fasting session (start time) | Per-user health |
| `notification_settings` | Meal/water reminder settings | Per-user |
| `last_water_notif`, `fired_notifs_today`, `last_app_boot` | Notification runtime state (timestamps, fired keys) | Per-user (device-ish, namespaced anyway) |
| `last_welcome_back_gap_date` | Welcome-back gap marker | Per-user |
| `shopping_list_<weekISO>` | Weekly shopping lists | Per-user |
| `milestones_unlocked`, `milestones_initialized`, `report_shared_at` | Milestones state | Per-user |
| `intake_draft` | Questionnaire draft (explicitly never uploaded — `src/platform/sync.ts` header) | Per-user health |
| `seasonal_activation` | Seasonal template activation + pre-activation water snapshot | Per-user |
| `accessibility_large_text`, `accessibility_high_contrast`, `dark_mode` | UI preferences | Per-user (harmless if shared; namespaced anyway) |
| `onboarding_seen`, `first_days_meal_viewed`, `first_days_started_at`, `coach_onboarding_seen` | Onboarding flags | Per-user |
| `coach_session_token` | Server HMAC coach-session token (60 min) | Per-scope (coach) |
| `coach_pin_hash`, `coach_pin_salt` | Salted SHA-256 PIN hash (`v2$…`) + per-device salt — never the PIN itself | Per-scope (coach); device-wide in `local` scope |
| `photos_db` | **IndexedDB database name** (not a localStorage value) — see §1.3 | Per-scope |

Every read/write of these keys resolves the key **at call time** through
`ns()` (`src/utils/storageKeys.ts:30-32`), so a scope change instantly
redirects all access. Verified: all 22 files that touch `localStorage` use
`StorageKeys` except the fixed keys in §1.2 (confirmed by grep for literal
keys — zero literal `localStorage.getItem('…')` calls in `src/`).

### 1.2 localStorage — fixed (non-namespaced) keys

| Key | Content | Why fixed / assessment |
|---|---|---|
| `nt_custom_plan_presets_v1` | Coach-created custom meal-plan templates (`src/utils/planPresets.ts:1112`) | **D2 (low):** the one user-content store outside the UID namespace; shared across all accounts on the device. Templates, not patient health records; coach surface is PIN-gated at device level |
| `sd_<brand>_coach_rate_limit` | Local PIN attempt counts + lockout timestamp (`src/utils/coachAuth.ts:50-52`) | Device security control by design (counts only, no user data); a lockout applies device-wide |
| `sd_platform_sync_status[_<uid>]` | Sync status: state, timestamp, day-log count, errors (`src/platform/sync.ts:213-216`) | UID-keyed in all app call sites (`PlatformApp.tsx:887,912,1052,1063`); the bare key is a test-only fallback. No health data — counts/timestamps only |
| `sd_<brand>_platform_local_data_owner` | Ownership binding marker `{version, patientUid, boundAt}` (`src/platform/localDataOwnership.ts:14-16`) | Device-level by design — it *is* the lock that says which account owns the legacy dataset |
| `sd_<brand>_migrated_v1` | One-time legacy-migration flag | Boolean, not user data |
| `sb-<project-ref>-auth-token` | Supabase session (managed by supabase-js; default storage) | Single slot per origin; holds exactly one session; removed by `signOut()` |
| `nt_v6_egypt_*`, `smartdiet_*` (legacy) | Pre-white-label keys | Migration sources only — read once by `migrateLegacyStorageOnce()` (`storageKeys.ts:110-145`), never written by current code; old values deliberately kept, never deleted |

### 1.3 IndexedDB

| Database | Store | Content | Scoping |
|---|---|---|---|
| `sd_<brand>_<scope>photos_db` | `progress_photos` (`id`, `date`, `ts`, `data` = compressed data URL) | Progress photos (`src/utils/indexedDB.ts:10-12`) | **DB name is scope-namespaced** via `StorageKeys.photoDbName()` — each UID gets its own database |
| `nt_private_photos_db` (legacy) | `progress_photos` | Pre-isolation photos | Migration source only; auto-migration runs **only** in `local` scope (`indexedDB.ts:84-86`); transfer into a user bucket requires a matched binding (`indexedDB.ts:96`) |

### 1.4 sessionStorage

| Key | Content | Scoping |
|---|---|---|
| `sd_<brand>_<scope>coach_unlocked` | Unlock proof `{v, exp, tag, bound}` — bound to the stored PIN hash, ≤60 min TTL (`src/utils/coachAuth.ts:104-147`) | Scope-namespaced key; per-tab lifetime (cleared when the tab closes). A scope switch makes the proof unreadable (different key) and invalid (bound to another scope's hash) |

### 1.5 Cache Storage (Service Worker)

| Cache | Content | Scoping |
|---|---|---|
| `nutrition-عيادة-التغذية-v4` | App shell (precache) + runtime-cached same-origin GET responses | **No per-account content**: API paths are excluded, Supabase is cross-origin, navigation responses are the public `index.html` shell (§5) |

## 2. Classification (PRIV-001 step 2)

- **Per-user health / private** (UID-namespaced): plan, day logs, fasting
  sessions, progress photos, intake drafts, milestones, shopping lists,
  notification settings, seasonal activations, coach session token + PIN
  hash (coach scope), sync status (UID-keyed).
- **Per-user non-health** (UID-namespaced anyway): UI preferences,
  onboarding flags, welcome-back marker, notification runtime state.
- **Public / non-personal** (not in browser storage at all): built-in plan
  templates and the default plan (in code), brand config, the app shell.
- **Device-level by design** (deliberately shared): PIN rate-limit state,
  ownership binding marker, migration flag, Supabase single-session slot.
- **Gap**: custom plan presets (D2) — coach content that should arguably be
  clinic-scoped but currently sits on one fixed device-wide key.

## 3. The isolation mechanism

Three scopes (`src/utils/storageScope.ts:8-14`):

- `local` — prefix ``: the anonymous single-clinic dataset (byte-for-byte
  compatible with the pre-platform app).
- `guest` — prefix `guest_`: an empty isolated bucket used after a
  device-bound patient signs out, so the legacy `local` dataset stays
  hidden from the next device user.
- `user:<uid>` — prefix `user_<uid>_`: one private bucket per
  authenticated platform account. UIDs are validated (`/^[A-Za-z0-9_-]+$/`)
  before use (`storageScope.ts:24-30`).

How it is enforced:

1. **Bootstrap before render** — `src/main.tsx:18-52`: scope starts as
   `local`, the legacy migration runs, then `bootstrapStorageScope()`
   resolves the scope from the persisted Supabase session UID and only then
   renders React. `startApp()` awaits the bootstrap, so no component can
   read the wrong scope. A `supabase.auth.onAuthStateChange` subscription
   keeps the scope aligned for the page lifetime (login, logout, refresh,
   account switch).
2. **Fail-closed** — if `getSession()` errors, the scope falls back to
   `guest` (if the device is bound) or `local`, never exposing the legacy
   namespace to an unknown identity (`main.tsx:46-50`). A corrupted
   ownership binding parses as `__invalid_binding__` and never authorizes
   an upload (`localDataOwnership.ts:35-55`).
3. **In-memory clear on scope change** — `src/App.tsx:128-151`: on every
   scope change the app reloads plan/day/notifications from the new scope,
   resets date/tab, re-reads dark mode and onboarding from the new scope,
   re-evaluates the coach unlock against the new scope's hash, closes all
   patient-specific modals, and clears compare photos. This prevents a
   cross-account flash of in-memory state.
4. **Ownership binding (legacy dataset lock)** — `src/platform/localDataOwnership.ts`:
   the legacy device dataset can be bound to exactly one patient UID, only
   after explicit UI confirmation, and the binding is immutable from the
   app (`bindLocalDataToPatient` throws if the device is already bound to
   another UID). A different account must use another browser profile/device
   or reset local data. The binding gates every copy/upload path.
5. **Adoption flows** — `src/platform/PlatformApp.tsx:878-1068`
   (`SyncSection`): on `mismatch`/`unavailable` the summary is empty and
   nothing is read, copied, or uploaded. On `unbound`, the legacy snapshot
   is shown **for review only as aggregate counts** (day-log count,
   shopping-list count, has-plan, has-fasting — no health content) via a
   read-only scope switch. Copying into the UID bucket requires explicit
   ownership confirmation; existing UID-scoped values always win
   (`copyLegacyPatientDataToUser`, `storageKeys.ts:161-219`); photos need a
   second, separate confirmation (`migrateLegacyPhotosToCurrentUser`,
   `indexedDB.ts:92-151`). On `matched` (bound by a previous version) the
   approved patient keys auto-copy into the UID bucket.
6. **Sync is opt-in and copy-only** — `src/platform/sync.ts`: migration to
   the cloud runs only when the patient presses «مزامنة بيانات جهازي» after
   explicit consent (consent saved to `consents/sync` first); the plan is
   written only if no cloud plan exists; day logs replace per-day; sections
   without Supabase tables stay local-only and are reported as such
   (SDV2-INT-002). **Nothing is ever deleted locally by sync.**
7. **Tests** — 25 tests cover the mechanism: `tests/storageScope.test.ts`
   (5), `tests/platform/storageScopeIntegration.test.ts` (4 — including the
   bootstrap-before-render ordering and the in-memory clear),
   `tests/platform/localDataOwnership.test.ts` (5),
   `tests/storageKeysMigration.test.ts` (4), `tests/platform/sync.test.ts`
   (7 — including per-UID sync-status isolation). All pass (see §10).
   These are static/unit tests — no test renders two accounts in a browser.

## 4. PRIV-001 verdicts in detail

### Step 1 — Inventory: PASS
§1 is the inventory: 24 scope-namespaced localStorage keys, 1
scope-namespaced IndexedDB, 1 scope-namespaced sessionStorage key, 6 fixed
keys (each justified or filed as D2), plus legacy migration sources, 1 SW
cache (public content only), and the Supabase session slot. The inventory
was built by grepping every `localStorage` / `sessionStorage` / `indexedDB`
/ `caches` use in `src/` (22 files touch localStorage; all route through
`StorageKeys` except the §1.2 fixed keys; zero literal key strings in
`src/`; `caches.*` appears only in `public/sw.js`).

### Step 2 — Classification: PASS
§2 classifies every store as per-user health, per-user non-health, public,
or device-level-by-design.

### Step 3 — UID namespace/store: PASS with one low gap
Every patient-data store is namespaced by Supabase UID: localStorage keys
via `ns()` (`storageKeys.ts:30-32`), the IndexedDB photo database via its
scope-namespaced name (`indexedDB.ts:78-80`), the sync status via its
UID-suffixed key (`sync.ts:213-216`), and the coach token/hash via `ns()`
in the active scope (`coachServer.ts:76-88`, `coachAuth.ts:44-48`). The gap
is D2 (custom plan presets on a fixed key) — coach templates, not patient
health records.

### Step 4 — Logout blocks the next account: PASS in code; live proof OPEN
On sign-out (`supabase.auth.signOut()`, `auth.tsx:216-219`) the
`onAuthStateChange` listener in `main.tsx` switches the scope to `guest`
(bound device) or `local` (unbound device). The signed-out UID bucket
becomes unreachable through the app: every key resolves through the new
scope, and `App.tsx:128-151` clears all in-memory health state. The next
account gets its own `user:<uid>` bucket, and the binding gate
(`SyncSection`) refuses to read, copy, or upload the legacy dataset to a
mismatched account. What code cannot prove — that no UI path anywhere
leaks a stale value after a real logout — needs browser test T2.

### Step 5 — Account switch loads only the new store: PASS in code; live proof OPEN
Same mechanism as step 4, plus: the scope switch fires
`sd-storage-scope-changed`, `App.tsx` reloads plan/day/notifications from
the new scope and closes patient modals; the photo DB name changes with
the scope (a different IndexedDB database); the coach unlock proof becomes
invalid (different sessionStorage key + hash binding); the sync status is
read from the new UID's key. The only cross-scope reads in the codebase
are `withStorageScope('local', …)` in `SyncSection` (gated on binding
status; counts-only summary on `unbound`, nothing on `mismatch`) and the
photo transfer (gated on `matched` binding + user scope). Live proof needs
browser test T1.

### Step 6 — Session-end wipe/lock strategy: PASS as LOCK
The implemented strategy is **lock by namespace, not wipe**. On logout the
UID bucket is sealed off by the scope switch; its contents are *not*
deleted, so the same account finds its local data on its next login
(the app is local-first — unsynced day logs live only on the device).
The strategy is stated in code: `storageScope.ts` header (scope model),
`main.tsx:46-50` (fail-closed on auth failure),
`localDataOwnership.ts:59-63` (binding "does not encrypt or fully
namespace browser data" — an honest scope statement),
`sync.ts` header ("ما يبقى محليًا أبدًا…").
**Limitation (D6):** the lock is in-app isolation only. The UID bucket's
bytes remain on disk after logout and are readable via DevTools by anyone
with physical device access. There is no encryption at rest and no logout
wipe. PROMPT 6 should record this threat-model boundary explicitly rather
than letting "isolated" be read as "encrypted" or "deleted".

### Step 7 — No silent deletion of unsynced data: PASS
No code path deletes user data on logout, account switch, sync, or
migration:
- Logout: `signOutPlatform` only signs out of Supabase; nothing touches
  localStorage.
- Sync: copies local → cloud; the local copy stays (`sync.ts` — no
  `removeItem` anywhere in the file).
- Adoption/migration: `copyLegacyPatientDataToUser` and
  `migrateLegacyPhotosToCurrentUser` copy and never delete the source
  (stated in their comments and in the UI messages shown to the patient).
- Legacy migration: `migrateLegacyStorageOnce` copies old keys and keeps
  the originals ("لا يحذف القديم حتى لا نخسر بيانات").
The only `removeItem` calls in `src/` are explicit user/state actions:
coach server-token clear on coach logout (`coachServer.ts:88`), intake
draft discard (`intake.ts:162`), seasonal activation removal
(`seasonalTemplate.ts:164`), fasting-session clear
(`storage.ts:204,216`), and the sessionStorage unlock-proof removal on
coach logout (`coachAuth.ts:387`). None of them touches another account's
data or runs silently on logout/switch.

### Step 8 — Two-account test: OPEN
Never run — the staging account passwords were never available to any
prompt (PROMPT 2 has the same blocker; the parent is resolving it via a
Supabase Dashboard password reset). Exact procedure in §9 (T1).

## 5. PWA / Service Worker verification

### 5.1 Registration — PASS
`registerServiceWorker()` (`src/utils/notifications.ts:180-191`) registers
`/sw.js` with `{ scope: '/' }` and forces a background update check
(`reg.update()`). It is called unconditionally on app boot
(`src/App.tsx:218-221`, `useEffect` on mount) — the effect is declared
before the `/platform` / `/owner` / `/coach` / `/prototype` early returns
(`App.tsx:332-361`), so the SW registers on **every** entry route,
including `/platform`. Push flows additionally wait on
`navigator.serviceWorker.ready` (`push.ts:56`, `notifications.ts:198,543`).
Health check: `SW_HEALTH_CHECK` message with a 1500 ms timeout
(`notifications.ts:195-221`); the SW answers `{status:'OK', active:true,
version, timestamp}` (`sw.js` message handler). Live SW registration status
was UNVERIFIED by the PROMPT 1 browser task (DevTools unreachable in that
environment) — browser test T4 closes it.

### 5.2 Manifest — PASS with notes
`public/manifest.json`: name `منصة التغذية والصحة - أخصائي التغذية`,
`short_name` `عيادة التغذية`, `start_url` `/`, `display` `standalone`,
`theme_color` `#4E9CE8`, `dir` `rtl`, `lang` `ar`, icons `/icon.svg`
(192/512 + maskable 512). `index.html` links the manifest, sets
`theme-color`, and includes Apple touch meta tags. Notes:
- Icons are **SVG-only**; no PNG 192/512 fallback exists in `public/`
  (D4 — possible factor in the missing native install prompt).
- The install button in the navbar is `hidden sm:flex`
  (`Navbar.tsx:180`) — hidden on phones (<640 px). On a phone the only
  install guidance is inside the onboarding modal.

### 5.3 Service Worker lifecycle — PASS
`public/sw.js` (live copy verified byte-identical to the repo file,
2026-11-21): `install` precaches 4 shell files and calls `skipWaiting()`;
`activate` deletes every cache whose name differs from
`nutrition-عيادة-التغذية-v4` and calls `clients.claim()`; the SW therefore
takes control promptly on update and never serves a stale shell from an
old cache version. The `push` handler shows a generic notification
(`تحديث جديد من العيادة`) — the server sends an empty payload by design
(PR #72); the handler accepts an optional `{title, body}` only for future
non-clinical messages (capped at 80/160 chars, invalid JSON ignored).
`notificationclick` focuses an existing window or opens the notification
URL (default `/`).

### 5.4 Fetch handler audit — PASS
`public/sw.js` fetch handler, in order:
1. Cross-origin requests: untouched (Supabase, fonts, everything else
   goes straight to the network).
2. Non-GET requests: untouched (all API writes bypass the SW).
3. Same-origin GET to `/rest/`, `/auth/`, `/functions/`, `/api/`:
   untouched — always network. (The `/rest/` etc. prefixes are inert on
   this origin since Supabase lives on `supabase.co`, but the exclusion
   is still correct defence-in-depth.)
4. Navigations: network-first; on success the response is cached; offline
   it falls back to the cached response or `/index.html`. Navigation
   responses are the public SPA shell — they contain no user data.
5. Other same-origin GET (static assets): cache-first with network
   fallback; successful network responses are runtime-cached
   (`cache.put`).
No private patient response can enter the cache: patient data travels over
Supabase (cross-origin) or `/api/*` (excluded), and both are GET-excluded
or path-excluded. The Cloudflare Worker itself never touches the Cache API
(no `cache` reference in `cloudflare-worker.mjs`), and `/api/*`,
`/health`, `/coach-session` run worker-first (`wrangler.jsonc`
`run_worker_first`), so API responses are never asset-cached either.

### 5.5 Install flow — manual instructions by design
There is **no** `beforeinstallprompt` listener anywhere in `src/` — the
app never captures or triggers the native install prompt. The navbar
«تثبيت التطبيق» button opens `InstallGuideModal` (iOS/Android tabs with
manual steps: Safari share → Add to Home Screen; Chrome menu → Install).
That matches the PROMPT 1 browser finding (manifest OK, no native prompt
observed on desktop Chrome). Whether the native prompt appears on the
user's Android Chrome — and whether the SVG-only icons affect it — is
unverified; browser test T5 settles it.

### 5.6 Live headers (preview, 2026-11-21 ~07:55)

| URL | Content-Type | Cache-Control |
|---|---|---|
| `/` | `text/html` | `public, max-age=0, must-revalidate` |
| `/sw.js` | `text/javascript` (no charset) | `public, max-age=0, must-revalidate` |
| `/manifest.json` | `application/json` | `public, max-age=0, must-revalidate` |
| `/icon.svg` | `image/svg+xml` | `public, max-age=0, must-revalidate` |
| `/assets/index-xfudTUID.js` | `text/javascript` | `public, max-age=0, must-revalidate` |

`wrangler.jsonc` sets no custom headers, so Workers Static Assets serve
its default (`max-age=0, must-revalidate`) for everything — including
content-hashed bundles. Two consequences, both assessed in §6:
`max-age=0` is *correct* for `/sw.js` (SW updates must revalidate), but it
means the HTTP cache is **not** an offline fallback for the JS bundle.
The missing charset on `/sw.js` explains the PROMPT 1 mojibake
observation (D5): SW scripts are decoded as UTF-8 by spec, so it is
cosmetically odd but functionally harmless.

## 6. Offline-precache risk assessment — MEDIUM-LOW

**The PROMPT 1 concern, restated precisely:** the precache list
(`/`, `/index.html`, `/manifest.json`, `/icon.svg`) omits the React
JS/CSS bundles, so an offline reload could serve a shell that cannot boot
— *if* the bundle is not available from another cache.

**What the evidence actually shows:**

1. **The HTTP cache is NOT a fallback.** Every response is served with
   `Cache-Control: public, max-age=0, must-revalidate` (live-verified,
   §5.6). A browser must revalidate before reusing such an entry, which it
   cannot do offline — so the HTTP-cached bundle is unusable offline.
   (This also applies to the Vercel deployment unless `vercel.json` sets
   different headers — not checked here; the preview is the subject.)
2. **The SW runtime cache IS the fallback, and it works after repeat
   visits.** The fetch handler cache-firsts same-origin GETs and
   `cache.put`s every successful response (§5.4 item 5). After one
   SW-controlled online load, the JS/CSS bundles live in Cache Storage and
   an offline reload boots normally.
3. **First-visit timing is the hole.** On the very first visit the SW
   installs *during* the page load; the first load's subresource fetches
   typically complete before the SW controls the page, so they are not
   runtime-cached. `skipWaiting()` + `clients.claim()` make the SW take
   control promptly, but reliable offline boot generally requires **≥2
   online visits**. A first-visit-offline user, or a user whose Cache
   Storage was evicted, gets the shell without a bootable bundle.
4. **No data risk either way.** Whether the offline boot succeeds or not,
   no previous user's data can appear: the shell contains no user data,
   and after boot the scope resolves from the persisted Supabase session
   (readable offline from localStorage) — the *current* user's bucket.

**Verdict: MEDIUM-LOW.** The normal case (a returning user, online at
least twice) works; the failure modes are first-visit-offline and
post-eviction boot. Recommended fix (NOT applied in this prompt):
generate the precache list at build time (e.g. `vite-plugin-pwa` /
Workbox `injectManifest`, or a small build script emitting the hashed
asset names into `sw.js`), and/or set immutable long-lived `Cache-Control`
for `/assets/*` so the HTTP cache becomes a genuine second fallback.
Fix locations: `public/sw.js` (precache list), `wrangler.jsonc`
(headers), `vite.config.ts` (build-time manifest).

## 7. Cross-account leakage trace

Every place local data is read or written, and whether it can serve one
account's data to another:

| Path | Scoping | Cross-account? |
|---|---|---|
| Plan / day logs / fasting / settings / milestones / shopping / seasonal / intake / welcome-back (via `StorageKeys` + `storage.ts`, `milestones.ts`, `shoppingList.ts`, `seasonalTemplate.ts`, `intake.ts`, `welcomeBack.ts`, `notifications.ts`) | `ns()` at call time | **No** — key changes with scope |
| Progress photos (`indexedDB.ts`) | Per-scope DB name | **No** — separate databases per UID; legacy transfer requires matched binding + explicit confirmation |
| Coach session token (`coachServer.ts`) | `ns()` | **No** — per-scope token |
| Coach PIN hash/salt (`coachAuth.ts`) | `ns()` | **No across platform accounts.** In `local` scope the hash is device-wide — by design for the single-clinic legacy mode (one coach per device, PIN-gated). A platform sign-in moves the coach store into that user's bucket, so a local-scope PIN cannot unlock the coach screen from inside a platform session and vice versa |
| Coach unlock proof (`coachAuth.ts`, sessionStorage) | `ns()` key + bound to the scope's hash + tab lifetime | **No** — invalid after any scope switch |
| Coach rate limit (`coachAuth.ts:50-52`) | Fixed device key | Shared by design (attempt counts only, no user data); a lockout applies device-wide |
| Sync status (`sync.ts`) | `sd_platform_sync_status_<uid>` | **No** in app use (UID always passed); counts/timestamps only |
| Ownership binding marker (`localDataOwnership.ts`) | Fixed device key | By design — it is the lock itself; it stores only a UID + timestamp, no health data |
| Custom plan presets (`planPresets.ts:1112`) | **Fixed key `nt_custom_plan_presets_v1`** | **YES — D2 (low).** Coach templates shared across all accounts on the device |
| Supabase session (`sb-<ref>-auth-token`, supabase-js) | Single slot per origin | **No** — one session at a time; `signOut()` removes it; a new sign-in replaces it |
| Realtime QA harness (`realtime-qa.tsx:21-24`) | `persistSession: false` | **No** — the three test clients never write sessions to storage |
| SW Cache Storage (`public/sw.js`) | One cache, public content | **No** — shell + static assets only; no per-account content enters the cache |
| `withStorageScope('local', …)` in `SyncSection` (`PlatformApp.tsx:896,929`) | Temporary read of the legacy scope | **No leak** — gated on binding status: `mismatch`/`unavailable` → empty summary without reading; `unbound` → counts-only summary; `matched` → the account already owns the data |
| `withStorageScope('local', …)` in photo transfer (`indexedDB.ts:100`) | Reads legacy DB name | **No leak** — gated on user scope + `matched` binding + explicit UI confirmation |
| `index.html` pre-render theme script | Regex over **all** `*_dark_mode` keys | **Cosmetic only — D3.** Picks the first matching key regardless of scope; affects only the pre-hydration theme flash (dark vs light), no health data |
| In-memory React state (`App.tsx:128-151`) | Reloaded on scope change | **No** — plan/day/notifications reloaded from the new scope; modals closed; compare photos cleared |
| Guest bucket (`guest_` scope) | Shared signed-out bucket | **By design, not a leak between accounts:** after a bound sign-out the app uses the empty guest bucket so the legacy dataset stays hidden. Data a *signed-out* user enters goes to the guest bucket and is visible to the next signed-out user — the same anonymous behaviour as the legacy single-clinic app. Authenticated accounts never read the guest bucket |

**Coach PIN store — direct answer to the brief:** the PIN hash is
**per-scope, not per-device** in platform mode (it follows the active
storage scope), and **per-device** in the legacy `local` scope. The
unlock proof is per-tab sessionStorage. The rate-limit counter is the
only device-global coach state, and it holds counts, not credentials.

## 8. Defects found (documented, NOT fixed)

| ID | Severity | Defect | Fix location |
|---|---|---|---|
| D1 | **Medium-Low** | Offline boot depends on the SW runtime cache; the HTTP cache cannot serve the bundle offline (`max-age=0` on all responses); first-visit-offline and post-eviction boot fail. See §6 | `public/sw.js` (precache list), `wrangler.jsonc` (asset headers), `vite.config.ts` (build-time precache manifest) |
| D2 | **Low** | Custom plan presets on fixed key `nt_custom_plan_presets_v1`, shared across all accounts on the device | `src/utils/planPresets.ts:1112` — route through `StorageKeys` with `ns()` + one-time migration of the fixed key |
| D3 | **Cosmetic** | `index.html` pre-render theme script picks the first `*_dark_mode` key regardless of scope | `index.html` inline script — resolve the key from the persisted session UID (as `main.tsx` does), or accept the flash |
| D4 | **Low / Open** | Manifest declares SVG-only icons (no PNG 192/512); no `beforeinstallprompt` handling — install is manual-instructions only; navbar install button hidden on phones (`hidden sm:flex`); native prompt never observed on desktop Chrome | `public/manifest.json` + PNG icons in `public/`; `src/components/Navbar.tsx:180`; add a `beforeinstallprompt` handler if a native prompt is wanted |
| D5 | **Info** | `/sw.js` served without charset (`Content-Type: text/javascript`) — explains the PROMPT 1 mojibake observation; functionally harmless (SW scripts decode as UTF-8 by spec) | Headers config if desired; no action required |
| D6 | **Limitation** | Logout locks by namespace; it does not wipe. UID-bucket bytes remain on disk after logout/switch, readable via DevTools with physical device access. No encryption at rest. Documented design (local-first), not a bug — but PROMPT 6 must state the threat model | Policy decision, not a code fix. If a wipe is ever wanted: clear the UID bucket on sign-out *after* confirming sync state (see step 7 — never silently delete unsynced data) |

No high-severity defect was found. No defect was fixed in this prompt, per
the brief (verification only).

## 9. Handoff — exact browser test procedures (parent)

Run on https://smart-diet-v2.saaedbelal.workers.dev. Combine with the PROMPT 2
Realtime session and the PROMPT 3 login tests — same staging accounts.
**Do not use the real coach PIN in any probe the user did not ask for;
do not make wrong-PIN attempts from the VM (2 of 5 already used).**

### T1 — Account switch isolation (PRIV-001 step 8; §10 item 11)
1. Sign in at `/platform` as `patienta@staging.test`. In the client
   dashboard, create a recognisable day-log entry (e.g. a note with a
   unique word) and confirm it saves.
2. Sign out («خروج»). Sign in as `patientb@staging.test`.
3. **Expected:** Patient B sees none of Patient A's data — no day-log
   entry, no plan values from A, empty/default dashboard. Check the
   browser DevTools → Application → Local Storage: keys under
   `user_<uid-B>_` exist; no `user_<uid-A>_` key is read (values may
   still be *present* on disk — that is the documented lock-not-wipe
   design, D6 — but the app must not display them).
4. Sign out, sign back in as Patient A. **Expected:** A's day-log entry
   is back (same-account persistence).
5. Repeat the switch in the other direction (B → A → B) to prove both
   directions.

### T2 — Logout blocks the next account (PRIV-001 step 4)
1. As Patient A, open a day log, then sign out **without** signing in as
   anyone else.
2. **Expected:** the login form returns; the client dashboard shows the
   guest/anonymous state — no A data visible. Reload the page:
   **expected** still no A data (scope stays `guest` on a bound device).
3. Open DevTools → Application → Local Storage and confirm the app is
   reading `guest_`-prefixed keys (or `local` if the device was never
   bound), never `user_<uid-A>_` keys.

### T3 — Offline reload (PROMPT 1 open item; §10 item 12)
1. Online, load the preview twice (two separate page loads — the first
   load installs the SW; the second runs under SW control and
   runtime-caches the bundles).
2. In DevTools → Network, enable Offline. Reload.
3. **Expected:** the app boots and shows the last signed-in user's data
   (offline read of their own bucket). **Must NOT show:** another
   account's data, or a shell that cannot boot. If it fails to boot,
   that confirms D1 and the fix becomes a PROMPT 6 decision.
4. Also test: offline reload immediately after a *first-ever* visit in a
   fresh browser profile. **Expected:** may fail to boot (D1) — record
   the actual behaviour.

### T4 — Service Worker registration (PROMPT 1 open item)
1. DevTools → Application → Service Workers. **Expected:** `/sw.js`
   registered with scope `/`, status Activated and running.
2. Application → Cache Storage. **Expected:** one cache
   (`nutrition-عيادة-التغذية-v4`) containing `/`, `/index.html`,
   `/manifest.json`, `/icon.svg` plus runtime-cached bundles after a
   second load. **Must NOT contain:** any `/api/*` response or any
   Supabase response.
3. Application → Manifest. **Expected:** no errors; name, icons, and
   `start_url` as in §5.2.

### T5 — Install prompt (real Android Chrome)
1. Open the preview in Chrome on a real Android phone. **Expected to
   check:** does Chrome offer an install prompt / install icon? Does
   «Add to Home Screen» work and launch standalone?
2. Record whether the SVG-only icons (D4) cause any installability
   warning in DevTools → Application → Manifest.

### T6 — Guest-scope behaviour (design check)
1. On a device where a patient previously bound local data and signed
   out, use the client dashboard signed out: add a day-log entry.
2. Sign in as a different patient, then sign out again.
3. **Expected:** the signed-out entry is visible only in the signed-out
   (guest) state, never inside any signed-in account.

### What code already proves vs what only the browser proves
- **Code proves:** the namespace mechanism, the scope-switch wiring, the
  in-memory clear, the binding gates, the SW cache exclusions, the
  header behaviour, the copy-never-delete policy.
- **Only the browser proves:** that no UI path anywhere displays stale
  data across a real switch/logout (T1/T2), that offline boot actually
  works after repeat visits (T3), that the SW registers and activates in
  a real browser (T4), and that install works on a real phone (T5).

## 10. Open items for PROMPT 6

1. **T1–T6 browser tests** (§9) — the live proof for PRIV-001 step 8,
   §3.4 item 7, and §10 items 11–12. Blocked on the staging account
   passwords (same blocker as PROMPT 2; parent is resolving it via a
   Supabase Dashboard password reset).
2. **D1 decision** — accept the ≥2-visit offline-boot requirement, or
   fix it (build-time precache manifest and/or immutable `/assets/*`
   headers). The fix is small but it is a code/config change, so it
   belongs to a follow-up task, not to this verification.
3. **D2 decision** — namespace the custom plan presets (small fix in
   `planPresets.ts`) or accept device-shared coach templates.
4. **D4 decision** — add PNG manifest icons + a `beforeinstallprompt`
   handler, or keep manual-instructions install.
5. **D6 threat-model statement** — the closure report must say plainly:
   local data is *isolated by namespace* between accounts and *locked*
   on logout; it is *not* encrypted at rest and *not* wiped on logout.
6. Google OAuth stays OPEN (PROMPT 3) — unaffected by this prompt.
7. PROMPT 2 Realtime test — unaffected by this prompt (same password
   blocker; the QA harness itself writes nothing to localStorage —
   `persistSession: false`).

## Appendix — evidence detail

- **Live headers** (§5.6) fetched 2026-11-21 ~07:55 from the preview
  with `curl -I`: all five checked URLs return
  `Cache-Control: public, max-age=0, must-revalidate`.
- **Live `/sw.js` is byte-identical** to `public/sw.js` on main
  (`diff` clean, 2026-11-21).
- **Live bundle staging-only** was already established by PROMPT 1
  (parent-verified) and PROMPT 3 (V1, 10 bundles scanned) — not
  re-verified here.
- **Tests:** 25 tests cover the isolation mechanism (counts in §3 item
  7); full suite result for this PR is recorded in the PR checks.
- **Grep evidence:** 22 files touch `localStorage` in `src/`; all route
  through `StorageKeys` except the §1.2 fixed keys; zero literal
  `localStorage.getItem('…')` calls; `caches.*` appears only in
  `public/sw.js`; zero `beforeinstallprompt` listeners in `src/`;
  zero `cache` references in `cloudflare-worker.mjs`.
- **No login was attempted anywhere in this prompt.** No
  `/api/coach-session` probe was made (2 of 5 failed attempts from this
  VM's IP already stand — per the brief, no further wrong-PIN probes).
