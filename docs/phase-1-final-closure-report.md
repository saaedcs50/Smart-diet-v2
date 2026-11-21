# Phase 1 — Final Closure Report (PROMPT 6)

**Date:** 21 November 2026 (execution 06:54–08:15 Cairo)
**Updated:** 21 November 2026 (evening, Cairo) — C2 closed by product-owner decision
(Google OAuth stays disabled; Email/Password is the approved auth method). See §7
decision 5 and the change log (§9). No settings, credentials, or code were changed by
that update — decision and documentation only.
**Final update:** 21 November 2026 (evening, Cairo) — C1 closed as a documented
equivalent alternative (PR #86) and C3 closed by live test (browser, both directions);
verdict **PHASE 1 — CLOSED**. See the disposition below, §7 decisions 6–7, §9, and
Appendices D–E. No settings, credentials, or code were changed by this update —
documentation only.
**Repository:** `saaedcs50/Smart-diet-v2`
**Preview (Cloudflare Workers + Static Assets):** https://smart-diet-v2.saaedbelal.workers.dev
(Staging only; deployment `daf4a7f7-cd88-4135-8663-344c716206b2`, 2026-11-21T05:14:22Z, 34 assets)
**Production:** `smart-diet-platform` (`lhjyshlxbsnesayivxpb`) — untouched by this work
**Staging:** `smart-diet-v2-staging` (`dubevgijagqjgwcibqeo`)
**Plan:** `docs/SMART-DIET-VERCEL-INDEPENDENCE-IMPLEMENTATION-PLAN.md` (committed verbatim in
this PR; §10 is the closure checklist this report judges against)
**Prior disposition:** `docs/phase-1-closure-followup-2026-11-21.md` — NOT CLOSED, 4 gates open

## Disposition: PHASE 1 — CLOSED

Hosting independence is **demonstrated, not merely claimed**: the Cloudflare preview is live
on the same Staging Supabase project, cross-clinic RLS isolation is proven by a live
Realtime test, email auth works on the alternate origin, local-data isolation is now
proven by a live two-account marker test in both directions (C3), and the migration
story is documented end-to-end with both chains converging on a real Supabase stack
(C1). Vercel is untouched and remains the rollback; no production data, DNS, or
schema was changed; no patient data moved to Cloudflare.

All three close-out items are closed. C1 (Gate 4, restore drill) is closed as a
**documented equivalent alternative**: the GitHub Actions restore test ran green on
the real Supabase stack for both chains (PR #86) — the residual gap (managed
dashboard provisioning) is recorded explicitly and is not a restore property (§7
decision 6). C2 (Google OAuth) was closed on the evening of 21 November 2026 by an
explicit product-owner decision: Google OAuth stays disabled for now, and
Email/Password is the approved authentication method. C2 is closed **by decision,
not by test** — Google sign-in was never enabled, tested, or configured (see §7
decision 5). C3 (live T1 proof) is closed by the browser test: each staging patient
sees only their own cloud day log, in both directions, with database confirmation
(Appendix D).

**Remaining action:** none of the remaining open items (O2–O19, §5) blocks closure.
The items still needing سعيد are the `/coach` correct-PIN confirmation (O4) and the
optional phone checks (O3: offline reload T3, install prompt T5). The managed-project
residual gap and the `trg_invitation_consume` question (O19) are recorded for a
future session.

| # | Close-out item | Owner | What closes it |
|---|---|---|---|
| C1 | **CLOSED 2026-11-21 (evening) as a DOCUMENTED EQUIVALENT ALTERNATIVE — Gate 4.** GitHub Actions run 3 (44945186144) SUCCESS on the real Supabase stack (PG 17.12, GoTrue, Realtime, PostgREST, Vault): production chain schema 18/18 + services 10/10; staging chain schema 25/25 + services 10/10; zero FAIL lines (PR #86, `docs/supabase-restore-test-2026-11-21.md`). Residual gap recorded: managed dashboard provisioning / extension config / project settings / network-SSL are not proven by a local stack — deliberately not closed by a managed disposable project (a third free project needs a new org or ~$25/mo Pro and adds no restore evidence). | — | Closed; see §7 decision 6 and Appendix E |
| C2 | **CLOSED BY DECISION 2026-11-21 (evening) — Google OAuth stays disabled.** Product-owner decision (سعيد, in chat): Google OAuth is not required now; Email/Password is the approved authentication method. Google sign-in was never enabled or tested — this item is closed as an approved product decision, not as a verified feature. No client credentials were installed and no OAuth settings were changed. | سعيد (decided) | Closed; see §7 decision 5. Reopen only if a future decision requires Google sign-in |
| C3 | **CLOSED 2026-11-21 (evening) — live isolation PASS in both directions.** Marker entries (`PHASE1-ISOLATION-TEST-A/B-2026`) in each patient's day-log notes + symptom fields; each patient sees ONLY their own cloud day log on /platform (count 1, dated 2026-11-21); no cross-marker found anywhere (page-text searches); the database confirms 2 day-log rows for 2026-11-21 (A 19:54:56 UTC, B 20:06:07 UTC); the device-binding guard was proven working in BOTH directions. Caveats recorded in Appendix D (platform list renders date/weight/water only; sync "partial success" by design; clinic-b grace did not block sync). | — | Closed; see Appendix D |

No close-out item remains. §5 lists the full open-items register (21 items: 18 open +
3 closed — C1, C2, C3); §3 gives the §10 verdicts
(16 PASS, 0 PARTIAL, 1 CLOSED BY DECISION, 0 FAIL).

## 1. What was done — per-prompt summary

All work ran on 2026-11-21 under the standing Smart-diet-v2 authorization (test/review →
merge on green CI → publish → delete merged branch). Every PR went through the token path
(`ght.py` git-database API); no App-path fallback was needed. `npm test`: 343 passed
(46 files) on every PR; lint 0 errors (259 pre-existing warnings).

| Prompt | Deliverable | PR / merge SHA | Outcome |
|---|---|---|---|
| PROMPT 0 — Inspection | Verified main `d091a551`, both Supabase projects live, Cloudflare account, 28 migration files; received the implementation plan | (verification only) | Baseline established; PR #75 left open (red CI — pre-existing picomatch warning), never merged |
| PROMPT 1 — Cloudflare preview | `docs/cloudflare-preview-deployment.md` + Worker + Hono API + `dist-cf/` build + CI workflow | #79 — `6587b05eab7e6931db9e0f59eb85acecdaa969b0` | Preview LIVE on `workers.dev` (Staging only). **Key finding (proven): Express 4.22.3 cannot run in a wrangler-bundled Worker** (iconv-lite bundle crash); Worker API runs Hono 4.13.16 with the session logic shared once in `src/server/coachSessionService.ts` |
| PROMPT 2 — Realtime + login tests | Browser verification on the preview (no repo change) | (browser tasks, parent-run) | Realtime isolation PASS on runs 2 and 3 (own 1/1, cross 0/0); run 1 failed all-zero (unexplained flake — §2 gate 1). Login tests all PASS; owner profile fixed (`clinic_id='platform'`) and owner login verified |
| PROMPT 3 — Auth + Google OAuth | `docs/auth-oauth-verification-2026-11-21.md` | #81 — `8f0171224b71d30fae10ac277ceb4d39d9649151` | Auth map = 3 mechanisms (`/platform` Supabase Auth, `/coach` PIN, QA harness). V1–V7 all PASS. `/login` resolved — not a route, not a bug. Google OAuth DISABLED by design, recorded OPEN (status superseded on the evening of 21 Nov — C2 closed by decision; see §7 decision 5) |
| PROMPT 4 — Migration reconciliation | `docs/migration-reconciliation-2026-11-21.md` | #80 — `7ca8cd786b07a446963ed2393ac717d12428b410` | Main's 28 files CANNOT rebuild either environment from empty (bootstrap gap documented); given the documented legacy seed, both chains converge exactly (prod 16/16, staging 28/28). PGlite drill proves convergence in real PG 17; Docker definitively closed in this VM |
| PROMPT 5 — Local data + PWA | `docs/local-data-pwa-verification-2026-11-21.md` | #82 — `21b978a5ff9bbb4068bf325e2562b6ef6fbb1541` | PRIV-001 mechanism real and fail-closed (UID namespace before render, 25 tests); PWA/SW exclusions proven in code; 6 defects documented, none fixed (D1 medium-low offline-precache risk; D6 logout-locks-doesn't-wipe limitation) |

### Evening close-out (21 November 2026)

| Item | Deliverable | PR / merge SHA | Outcome |
|---|---|---|---|
| C2 — Google decision | Report §7 decision 5 + §10 item 9 → CLOSED BY DECISION | #84 — `89fb4619a10e4dd0081c2cd9410bed4193c0d64e` | Google OAuth stays DISABLED by explicit product-owner decision; Email/Password is the approved auth method. No settings, credentials, or code changed |
| Cloudflare independence + security review | `docs/cloudflare-independence-security-review-2026-11-21.md` | #85 — `e9972e68fa275d08096b53d4ac394a0a0d489f5c` | All 10 checks PASS (re-verified live ~21:50); no unaddressed Critical/High finding; one Low (F1: per-IP limiting bypassable by IP rotation — inherent, mitigated by the 10^8 PIN space + coach-only scope). Tests re-run: 343/343, lint 0 errors, build + build:cloudflare OK, tsc exit 0. **Correction:** the VM's egress IP rotates per request, so the morning's "2 of 5 wrong-PIN attempts" framing was wrong — the lockout budget was never consumed (§6.5) |
| C1 — Supabase restore test | `docs/supabase-restore-test-2026-11-21.md` + `.github/workflows/supabase-restore-test.yml` + `scripts/supabase-restore-test/` | #86 — `fb07f864ae21285bfc8c6fc3b737b04c8096f23a` | GitHub Actions run 3 SUCCESS on the real Supabase stack (both chains green — see Appendix E). Gate 4 CLOSED as a documented equivalent alternative |
| C3 — live marker isolation test | Browser tasks on the preview (no repo change) | (browser tasks, parent-run) | PASS in both directions — see Appendix D |

Worker secrets (all 4: `COACH_PIN`, `SESSION_SECRET`, Upstash URL + token) were set by سعيد
as Cloudflare Secrets on 2026-11-21 ~07:38–07:47. Parent-verified 07:47: wrong PIN returns
403 «رمز PIN غير صحيح» (was 503) — the full chain works (boot validation + Upstash guard
store + PIN check). Vercel secret values are unrevealable by design; the Upstash pair came
from the Upstash console. No secret value appears in any repo file, log, or chat message.

## 2. The four gates (follow-up doc §3) — verdicts

| Gate | Verdict | Evidence |
|---|---|---|
| **1. Authenticated Realtime browser test** | **CLOSED** | Two-clinic isolation test on the preview, 3 runs: run 1 FAIL (all four counts 0, no sign-in error — unexplained first-run flake), runs 2 and 3 PASS with the exact expected pattern (own 1/1, cross 0/0). Cross-clinic delivery was 0 in **all three** runs — the safety direction never failed. The flake is a reliability observation (O11), not a gate failure: the gate asked for a demonstrated test, and it is demonstrated twice |
| **2. Alternate-origin Auth test** | **CLOSED** — email ✓ (proven live); Google closed by decision, not by test | Email sign-in, sign-out, and session-restore all proven live on the preview (§3, item 9; Appendix C). `https://smart-diet-v2.saaedbelal.workers.dev/**` added to the Staging redirect allow-list (localhost kept; Site URL still `http://localhost:3000`; Production untouched). Google OAuth: provider disabled on both projects, no Client ID/secret configured — CLOSED BY DECISION on the evening of 21 Nov 2026: the product owner decided Google OAuth stays disabled for now and Email/Password is the approved auth method (§7 decision 5). The gate's Google half is closed by decision, not by test — Google sign-in was never enabled or tested |
| **3. Exact migration source mapping** | **CLOSED as a mapping exercise — with a recorded low-priority gap (O13)** | Every ledger record maps to a Git file or a named branch file with a verdict (PROMPT 4 §2–§3); the two known hash differences are explained (§5.4, §5.5); both chains converge in the clean-room drill given the documented seed. Live-vs-live byte-exactness is now closed by the MD5 follow-up (12 shared migrations byte-identical, 2 differ — Appendix A). Residual gap: byte-exact *file-vs-live* text comparison for 13 files (11 Nov-9 + 2 alignment) was never performed — version/name + drill end-state only. Low priority: end state, not text, is what a rebuild needs |
| **4. Clean Supabase restore drill** | **CLOSED as a DOCUMENTED EQUIVALENT ALTERNATIVE** (close-out item C1) | GitHub Actions restore test on the real Supabase stack (PR #86): run 3 SUCCESS — production chain schema 18/18 + services 10/10, staging chain schema 25/25 + services 10/10, zero FAIL lines. Auth (user creation, password sign-in, JWT via PostgREST), RLS isolation over the Data API, RLS-filtered Realtime delivery, and Vault round-trip all proven against the restored schema. The PGlite drill's convergence proof is independently reproduced by the committed smoke test. Residual gap (recorded, not hidden): managed dashboard provisioning / extension config / project settings / network-SSL are not proven by a local stack — deliberately not closed by a managed disposable project (see §7 decision 6 and Appendix E). Docker remains definitively unusable in this VM; the test runs on GitHub Actions runners instead. The baseline snapshot remains a schema-only export, not a recoverable backup of patient data |

## 3. Plan §10 — 17-item closure checklist

Quoted from the implementation plan §10 («لا يعتبر العمل مكتملًا إلا عند تحقق جميع الشروط
التالية»). Verdicts: **16 PASS, 0 PARTIAL, 1 CLOSED BY DECISION, 0 FAIL.**
"CLOSED BY DECISION" (item 9 only) means the item is closed by an approved
product-owner decision, not because the plan's literal condition was met — see the
item's evidence line and §7 decision 5.

| # | §10 condition (abridged) | Verdict | Evidence (one line; detail in the cited doc) |
|---|---|---|---|
| 1 | React UI does not depend on a fixed Vercel address for the API | **PASS** | API base is config-driven; the same frontend runs against the Workers API on the preview; no hardcoded Vercel URL in the auth flows (PROMPT 3, V6) |
| 2 | An independent API runtime exists (or a documented decision to keep some routes on Vercel) | **PASS** | Hono 4.13.16 Worker runtime deployed and live; Express-on-Workers proven impossible (PROMPT 1, §2.6 proof) |
| 3 | `api/index.ts` holds no Vercel-exclusive business logic; adapter only | **PASS** | Verified in this prompt: `api/index.ts` is a thin Express bootstrap (mounts `apiRouter`); the session logic lives once in framework-free `coachSessionService.ts`, called by the Express adapter (`src/server/api.ts`) and the Hono adapter (`cloudflare-worker.mjs`) |
| 4 | `/api/coach-session` works outside Vercel at the same security level | **PASS** (live correct-PIN pending — O4) | Wrong PIN → 403 live (proves boot validation + Upstash guard + PIN check); correct-PIN 200 proven in local `wrangler dev` with the same code; shared logic + shared Upstash store = same security level. The live correct-PIN unlock awaits سعيد's own confirmation (his IP + his PIN) |
| 5 | Rate limiting works via Upstash from the independent runtime | **PASS** | Shared Upstash Redis store; the missing-token guard message appeared live before the secrets were set and the 403 after — proving guard-store connectivity from the Worker. Live 429 lockout NOT demonstrated (the VM's egress IP rotates per request, so per-IP counters never accumulate from this VM — not feasible here; review §4.3); lockout proven in unit tests (`tests/workerApi.test.ts:117`, `tests/serverApi.test.ts:121`) + local `wrangler dev` (403 ×5, then 429). Per-IP limiting is bypassable by rotation — a Low finding (F1), inherent to IP-keyed limiting, mitigated by the 10^8 PIN space + coach-only scope |
| 6 | Supabase URL + public key unchanged when switching frontend hosting | **PASS** | Same Staging project on both origins; staging ref present / production ref absent (0 matches) in all 10 live bundles (PROMPT 3, V1) |
| 7 | No `service_role` or secret inside the browser bundle | **PASS** | `service_role` / `client_secret` / `apps.googleusercontent.com`: 0 matches in all 10 live bundles and 0 values in tracked source (PROMPT 3, V2) |
| 8 | RLS blocks cross-clinic access in live tests | **PASS** | Realtime isolation test: cross-clinic delivery 0 in all 3 runs; own delivery 1/1 on runs 2–3 (run-1 flake: O11). RLS role-matrix script re-run against Staging 21 Nov without exception (follow-up §1) |
| 9 | Email **and** Google auth work on the test origin | **CLOSED BY DECISION** — email ✓, Google disabled by decision (not working, not tested) | Email sign-in / sign-out / session-restore proven live on the preview (Appendix C). Google: disabled on both projects, no credentials configured — and it stays that way by explicit product-owner decision (سعيد, in chat, evening of 21 Nov 2026): Google OAuth is not required now; Email/Password is the approved auth method. The plan's literal condition ("email AND Google work") is therefore NOT met — Google does not work and was never enabled or tested — but the item is closed as an approved product decision, not as a verified feature (§7 decision 5). No credentials were installed and no OAuth settings were changed |
| 10 | Storage and Realtime work within user/clinic permissions | **PASS** | Storage: zero buckets by design (progress photos are local in IndexedDB — follow-up §1). Realtime: publication is `public.profiles` only, UID-filtered channels; isolation proven live (item 8) |
| 11 | Local data is isolated by UID and does not appear after account switch | **PASS** | Mechanism proven in code (scope from persisted UID before render, in-memory clear on switch, binding gates; 25 tests) AND by the live T1 marker test (C3, Appendix D): each patient sees only their own cloud day log (count 1, dated 2026-11-21); no cross-marker found anywhere; DB confirms 2 day-log rows (one per patient); the device-binding guard was proven working in both directions. Caveat: /platform renders date/weight/water only — the marker text itself is not displayed there, so the cloud isolation is evidenced by counts/dates + page-text searches + DB rows, not by visible marker text |
| 12 | PWA shows no cache belonging to a previous account | **PASS in code** (live T3/T4 open — O3) | Structural, not behavioural: the SW cache can never contain per-account content — the fetch handler skips `/rest/`, `/auth/`, `/functions/`, `/api/`, all non-GET, and all cross-origin (Supabase) requests; navigation responses are the public shell. Live `/sw.js` is byte-identical to the repo file. Offline-reload / DevTools confirmation (T3/T4) was not run — phone/DevTools-only |
| 13 | Edge Function `notify` works without depending on the deleted Worker | **PASS** | Notifications moved to Supabase in PR #72: `push.ts` calls `functions/v1/notify` directly; the Edge Function was ACTIVE (prod v5 / staging v2, `verify_jwt=true`) at the 18 Nov status check (plan §1.1, §4.1); the old Cloudflare FCM Worker was deleted in PR #32 and no Worker proxy was created. End-to-end delivery was not re-tested in this run (O12) |
| 14 | Push sends no unencrypted sensitive health data | **PASS by design** (live delivery untested — O12) | The payload is empty by design (plan §1.1, §4.1.6, §4.2): no names, diagnoses, weight, or plan content; the SW shows a generic notification. RFC 8291 encryption is required only before any non-empty payload is ever sent — and none is. The plan itself notes empty payload ≠ proven delivery; real-device delivery testing remains open |
| 15 | The second hosting uses the same Supabase project | **PASS** | Preview uses the existing Staging project; no new Supabase project was created (PROMPT 1) |
| 16 | A workable rollback exists and needs no database move | **PASS** | Vercel untouched; removing the preview is one command (`npx wrangler delete smart-diet-v2`); no DNS or data is involved (PROMPT 1, Rollback) |
| 17 | No clinical calculations, subscription model, or dashboard features changed outside the task scope | **PASS** | PROMPT 1 changed hosting only; PROMPTs 3/4/5 are documentation-only; PROMPT 2 changed staging seed data only (owner `clinic_id`). No product logic was touched |

## 4. Threat model — what "isolated" means and does not mean

This section states the security boundaries plainly, so no verdict in this report is read
as stronger than the evidence supports.

**Local data (PROMPT 5, D6 — the most important boundary).** Local data is **isolated by
namespace between accounts and locked on logout; it is NOT encrypted at rest and NOT wiped
on logout.** On sign-out the scope switch seals the UID bucket off from the app, but the
bucket's bytes remain on disk and are readable via DevTools by anyone with physical device
access. This is the documented local-first design (unsynced day logs live only on the
device; wiping on logout would silently delete them — PROMPT 5 step 7 proves no code path
deletes user data on logout/switch/sync/migration). "Isolated" in this report always means
in-app namespace isolation, never encryption or deletion. A future wipe-on-logout feature
would need to confirm sync state first and is a policy decision, not a bug fix.

**Coach PIN attempts.** **Correction (§6.5):** the morning's "2 of 5 wrong-PIN attempts"
framing was wrong — this VM's egress IP rotates on every request (9 distinct IPs in 9
tries, review §4.2), so per-IP guard counters never accumulate from this VM and the
lockout budget was never actually consumed (the 65-minute entry TTL also expired the
morning's entries ~13 hours before the evening's probes). The caution remains as
policy: **no further wrong-PIN probes may be made from this VM.** The correct-PIN test
belongs to سعيد (his IP + his PIN).

**Secrets.** No secret value (PIN, session secret, Upstash token, OAuth secret, service
key) appears in any repo file, log, or chat message from this execution. Vercel secret
values are unrevealable by design (the grey text in Vercel's edit form is a placeholder
example, not the value). Worker secrets live in the Cloudflare Dashboard; the yellow
wrangler-sync banner there is ignorable — dashboard Secrets persist across deploys, and
secrets must never be put in `wrangler.jsonc` vars.

**Production.** No production database write, schema change, DNS change, or deployment was
made in this execution. Production Supabase was read-only throughout (ledger/function
queries only). The original `Smart-diet` repository and `youngtube-worker` were never
touched.

**Test accounts.** The three staging test accounts (`patienta@`, `patientb@`,
`owner@staging.test`) had their passwords reset via a bcrypt UPDATE in the Staging SQL
Editor (one shared transient test password, generated for the task, never stored in files,
memory, or chat). The staging owner profile's `clinic_id` was set to `'platform'` (the
documented convention; `profiles.clinic_id` has no foreign key) after the platform
rejected the empty value. All writes were Staging-only synthetic data. The passwords
were reset again in the evening for the C3 test (same method, a new shared transient
test password, verified by successful sign-ins for all three accounts; never stored).

## 5. Open-items register

Severity: **High** = blocks closure or a security property; **Medium** = real limitation,
bounded; **Low** = small fix or decision; **Info** = observation. Owner "سعيد" means only
he can do it (his credentials, his phone, his decision).

| ID | Item | Sev. | Owner | Next step |
|---|---|---|---|---|
| C1 | **CLOSED 2026-11-21 (evening) as a DOCUMENTED EQUIVALENT ALTERNATIVE** — Gate 4 (PR #86, `docs/supabase-restore-test-2026-11-21.md`). GitHub Actions run 3 SUCCESS on the real Supabase stack: production schema 18/18 + services 10/10; staging schema 25/25 + services 10/10; zero FAIL lines. Residual gap recorded: managed dashboard provisioning / extension config / project settings / network-SSL not proven — a managed disposable-project restore would close it fully (deliberately not done: a third free project needs a new org or ~$25/mo Pro and adds no restore evidence) | — | — | Closed. If the managed provisioning path itself ever needs validating (e.g. before a real production rebuild), that is the remaining step |
| C2 | **CLOSED BY DECISION 2026-11-21 (evening)** — §10 item 9, Google half: Google OAuth stays disabled by explicit product-owner decision (سعيد, in chat). Email/Password is the approved authentication method. Google was never enabled or tested; no credentials were installed and no OAuth settings were changed | — | سعيد (decided) | Closed. Reopen only if a future decision requires Google sign-in; enabling would then follow the PROMPT 3 procedure (dedicated client creds in Supabase staging → workers.dev in the redirect allow-list → Supabase callback in Google Cloud → rebuild with `VITE_GOOGLE_OAUTH_ENABLED=true` → test staff sign-in). Never reuse the Firebase client |
| C3 | **CLOSED 2026-11-21 (evening) — live isolation PASS in both directions** (Appendix D). Markers `PHASE1-ISOLATION-TEST-A/B-2026`; each patient sees only their own cloud day log (count 1, 2026-11-21); no cross-marker anywhere; DB confirms 2 day-log rows; device-binding guard proven working both ways | — | — | Closed |
| O1 | (same as C2 — closed by decision, see C2) | — | — | — |
| O2 | D1 (Medium-Low): offline boot needs ≥2 prior online visits — precache omits the JS/CSS bundles and the HTTP cache is not a fallback (`Cache-Control: public, max-age=0, must-revalidate` on every preview response). First-visit-offline and post-eviction boot fail. No data risk | Medium | Next dev task | Decide: accept the ≥2-visit requirement, or fix (build-time precache manifest and/or immutable `/assets/*` headers). Fix locations: `public/sw.js`, `wrangler.jsonc`, `vite.config.ts` |
| O3 | T3/T4/T5 live proof: offline reload, DevTools SW/cache inspection, install prompt on real Android Chrome — not doable in cloud-browser tooling (no offline toggle/DevTools) | Low | سعيد (phone) | On his Android phone: load the preview twice, go offline, reload (T3); check the install prompt (T5). T4 needs DevTools via remote debugging — optional |
| O4 | `/coach` correct-PIN unlock on the preview untested by us (wrong PIN 403 proven; correct PIN is his) | Low | سعيد | Confirm `/coach` unlocks with the real PIN on the preview |
| O5 | D2 (Low): custom plan presets on fixed key `nt_custom_plan_presets_v1`, shared across all accounts on the device (coach templates, PIN-gated — not patient health records) | Low | Next dev task | Route through `StorageKeys` + one-time migration, or accept device-shared coach templates |
| O6 | D4 (Low/Open): SVG-only manifest icons (no PNG 192/512); no `beforeinstallprompt` handler — install is manual-instructions only; navbar install button hidden on phones | Low | Next dev task | Add PNG icons + a `beforeinstallprompt` handler, or keep manual install |
| O7 | §5.5: `revoke_excess_public_table_privileges` file FAILS on a pure staging file chain (missing manual `anon` grant on `platform_config`) — a genuine file-chain documentation defect. End state is correct on both projects; the file as written is not replayable on staging without the manual grant | Medium | Next dev task | Record the manual grant as a documented seed requirement (done here and in the PROMPT 4 doc); do NOT edit the historical file or insert ledger rows |
| O8 | No staging baseline snapshot exists (production has one: `supabase/baselines/production-schema.sql`, validator PASS) | Low | Next dev task | Create a staging baseline snapshot the same way, so staging has a self-contained schema source |
| O9 | RegisterForm cosmetic sentence mentions the Google button unconditionally (`PlatformApp.tsx:786-789`) while the button is gated away | Cosmetic | Next cleanup | Gate the sentence with the same OAuth flag, or reword it |
| O10 | `/platform/register` (needs a fresh admin-created invitation) and password reset (fake `staging.test` domain cannot receive mail) untestable in this run | Low | Parent / browser | Test with a real invitation + a real mailbox when available, or record as accepted-untestable |
| O11 | Realtime run-1 flake: first run failed with all counts 0, unexplained; runs 2–3 passed. Cross-clinic delivery was 0 in all runs | Low | Parent / browser | If the test is ever re-run and the flake recurs, investigate (subscription warm-up vs Realtime service); a single first-run flake after months of account inactivity is consistent with warm-up |
| O12 | RFC 8291 payload encryption unimplemented; end-to-end push delivery never tested on a real device (payload is empty by design, so nothing sensitive is sent — but delivery itself is unproven) | Low | Next dev task | Real-device push delivery test when notifications are next touched; RFC 8291 only before any non-empty payload |
| O13 | Byte-exact file-vs-live text comparison for 13 migration files (11 Nov-9 + 2 alignment) never performed — version/name + drill end-state only | Low | Next dev task | Compute file-text MD5s in the Postgres array representation and compare against Appendix A (the live hashes are now on file) |
| O14 | `/tmp/drill` PGlite harness is GONE (verified this prompt: the directory no longer exists — ephemeral `/tmp`). The drill is reproducible from the PROMPT 4 doc §6 (method + seed assumptions + results), which is the durable record | Info | — | Any future drill must be built as a committed script under `scripts/` from the start, not in `/tmp` |
| O15 | Staging Site URL is still `http://localhost:3000` (a leftover dev setting). The redirect allow-list now includes the preview origin, which is what the auth flows need; the Site URL itself was deliberately left unchanged | Info | Parent / browser | Change to the preview origin only if a flow is found that depends on Site URL rather than the allow-list |
| O16 | Staging clinic subscription shows an expired banner («اشتراك العيادة انتهى») on the patient dashboard; the owner dashboard shows 1 active subscription and 1 in grace. Observation only — it did not block any test: clinic-b (grace, all dates NULL) synced successfully in the C3 test, and the SQL status change is refused BY DESIGN by the subscription guard trigger (`guard_clinic_subscription_payment_append`) — activation must go through the app's owner/admin payment flow, never via SQL | Info | — | Re-seed the staging subscription if a test ever needs an active-subscription patient |
| O17 | D3 cosmetic: `index.html` pre-render theme script picks the first `*_dark_mode` key regardless of scope (pre-hydration theme flash only) | Cosmetic | Next cleanup | Resolve from the persisted session UID, or accept the flash |
| O18 | D5 info: `/sw.js` served without charset (explains the PROMPT 1 mojibake observation; functionally harmless — SW scripts decode as UTF-8 by spec) | Info | — | No action required |
| O19 | Does live staging have `trg_invitation_consume` via manual provisioning? The staging chain creates 2 triggers, not 3 (C1 doc §6); the invitations RLS policy enforces the same state-transition rules either way, so there is no functional impact | Info | Parent / browser | One read-only query on the live staging database |

## 6. Corrections to earlier reports

Recorded here so a future reader does not inherit the errors:

1. **There is no "owner sanity check" button or test in the Realtime QA harness.**
   The PROMPT 1 browser report listed a «Run owner sanity check» button, and the PROMPT 3
   doc §1.3 repeated the claim. Both are wrong. Verified in this prompt against the harness
   source (`src/platform/realtime-qa.tsx`, PR #75 branch, 250 lines): zero matches for
   "sanity", exactly one button («Run two-clinic Realtime test»). The owner check is part
   of the isolation test itself (the owner account generates the profile-update events);
   the live browser task confirmed the deployed page has only the one button.
2. **Staging-only migration count is 14, not 12.** A browser report said staging has "12
   additional" migrations; the tables in Appendix A are authoritative: 28 staging = 14
   shared names + 14 staging-only; 16 production = 14 shared + 2 production-only.
3. **`/login` is not a route — and that is not a bug** (PROMPT 3 §1.4). `App.tsx` defines
   no `/login`/`/signin`/`/auth` route; the email/password sign-in lives inside
   `/platform`. Earlier browser findings that "/login serves the dashboard with no sign-in
   form" describe the intended design, not a defect.
4. **The PROMPT 1 doc's "secrets not set" status is superseded.** All 4 Worker secrets
   were set 2026-11-21 ~07:38–07:47 and the full coach-session chain was verified live
   (wrong PIN → 403). The PROMPT 1 doc was written before the secrets were set; this
   report is the current record.
5. **The "2 of 5 wrong-PIN attempts" framing was wrong** (review §11.2). This report's
   §4 recorded two wrong-PIN attempts "from this VM's IP — 2 of 5 before the lockout".
   The premise (a stable VM IP) is false: the VM's egress IP rotates on every request
   (9 distinct IPs in 9 tries), so no single guard key ever accumulated more than 1
   attempt from this VM, and the 65-minute TTL expired the morning's entries long
   before the evening's probes. The lockout budget was never consumed. The caution
   (no further probes from this VM) remains as policy.
6. **The staging chain creates 2 triggers, not 3** (C1 doc §6). PROMPT 4 §6.3 lists 3
   triggers for staging — a documentation error. The staging chain creates exactly 2
   (`clinic_subscription_payment_append_guard` and `appointments_validate_booking`);
   `trg_invitation_consume` is created only by the production alignment file. Whether
   live staging has the trigger via manual provisioning is an open question (O19) with
   no functional impact.
7. **Unknown `/api/*` 404 is plain text, not JSON** (review §11.1). The PROMPT 1 doc
   says the Worker answers unknown `/api/*` paths with "Hono's JSON 404"; the actual
   response is plain-text `404 Not Found` (Hono's default handler). The substance is
   unchanged (404 where Express answers its HTML 404); only the format description
   was imprecise.

## 7. Decisions recorded in this report

1. **The implementation plan is committed into the repo in this PR**
   (`docs/SMART-DIET-VERCEL-INDEPENDENCE-IMPLEMENTATION-PLAN.md`, 825 lines, verbatim).
   The follow-up doc and this report both judge against its §10 checklist; until now the
   file lived only in the agent's workspace and the in-repo references dangled. The file
   was scanned before committing: it contains no secret values (only generic mentions of
   PINs/tokens as concepts and instructions not to leak them). It is the source of truth
   for §10; if it ever conflicts with older text, the plan's §1.1 correction (18 Nov)
   governs.
2. **The `/tmp/drill` harness is not preserved** — it no longer exists (O14). The PROMPT 4
   doc §6 is the durable record of the drill (method, seed assumptions, results, and the
   run-1/run-2 failures that are themselves evidence for the bootstrap gap). A future
   drill must be committed under `scripts/` from the start.
3. **No staging baseline snapshot was created in this run** (O8). It is recommended
   follow-up work, not a Phase 1 gate: the production baseline + the drill's staging
   convergence proof cover the restore story at the level this phase requires.
4. **No historical migration file was edited and no ledger row was fabricated,**
   per the plan's non-negotiables and the PROMPT 4 recommendation. The three
   end-state-identical diffs (§5.1–§5.3 of the PROMPT 4 doc) are history, not defects.
   The one genuine defect (§5.5) is recorded as a documentation gap (O7), not repaired
   by rewriting history.
5. **Google OAuth stays disabled — approved product decision (21 November 2026,
   evening).** The product owner (سعيد) decided in chat that Google OAuth is not
   required now: it stays DISABLED, and Email/Password is the approved authentication
   method. Close-out item C2 is therefore **CLOSED BY DECISION — not by test**.
   Nothing was enabled, tested, or configured: no client credentials were created or
   installed, no OAuth settings were changed, and the provider remains disabled on
   both Supabase projects with `VITE_GOOGLE_OAUTH_ENABLED=false` in the preview
   build. The PROMPT 3 doc's §3 record (Google OPEN by design as of the morning of
   21 Nov) is a correct point-in-time verification; this report supersedes its
   *status*, not its evidence — the PROMPT 3 doc itself is left unchanged as the
   morning record, with a one-line pointer to this decision. If a future decision
   requires Google sign-in, enabling follows the PROMPT 3 procedure (dedicated
   client, staging first, never the Firebase client). §10 item 9 is CLOSED BY
   DECISION on the same basis: email ✓ (proven live), Google disabled by decision
   (not working, not tested) — the plan's literal "email AND Google work" condition
   is not met, and this report does not claim otherwise.
6. **Gate 4 is closed as a documented equivalent alternative — not by a managed
   disposable project (21 November 2026, evening).** The GitHub Actions restore test
   (PR #86) proves the documented seed + migration chain applies cleanly on the real
   Supabase stack and converges to the exact expected end state on both chains, with
   Auth, RLS-filtered Realtime, and Vault all working against the restored schema —
   which is what Gate 4 exists to establish. A restore into a managed disposable
   project would additionally exercise the dashboard provisioning path itself, but
   was deliberately not done: سعيد already has 2 free Supabase projects, so a third
   would need a new organization or a Pro plan (~$25/month), and it would add no
   restore evidence beyond what run 3 already proves. The residual gap (managed
   provisioning / extension config / project settings / network-SSL) is recorded
   explicitly in the C1 doc (§8–§9) and in the C1 register row — closing Gate 4 on
   the local-stack evidence does not claim those were tested.
7. **Phase 1 is CLOSED with the remaining open items (O2–O19) as non-blocking
   follow-up (21 November 2026, evening).** Every closure criterion in the evening
   task is met: C1 by documented equivalent, C2 by decision, C3 by live test,
   Cloudflare preview + API + security + staging connectivity verified (PR #85),
   no unaddressed Critical/High finding, CI green, documentation updated. The
   remaining items are bounded follow-ups (owner confirmations, phone checks,
   low-priority defects, the managed-project residual gap) — none of them is a
   Phase 1 gate, and none indicates a defect in the hosting independence.

## 8. Evidence index

| Claim | Source |
|---|---|
| Preview live, deployment, assets, Hono decision, Express impossibility proof | `docs/cloudflare-preview-deployment.md` (PROMPT 1) |
| Auth map (3 mechanisms), V1–V7, `/login` resolution, Google OPEN by design as of the morning of 21 Nov — status superseded by the evening decision (§7.5) | `docs/auth-oauth-verification-2026-11-21.md` (PROMPT 3) |
| Migration ledger maps, drift resolutions, PGlite drill, ordered chains | `docs/migration-reconciliation-2026-11-21.md` (PROMPT 4) |
| PRIV-001 8 steps, PWA/SW audit, D1–D6, T1–T6 procedures | `docs/local-data-pwa-verification-2026-11-21.md` (PROMPT 5) |
| The 4 gates, prior NOT CLOSED disposition, RLS role-matrix re-run | `docs/phase-1-closure-followup-2026-11-21.md` |
| §10 17-item checklist, §1.1 correction, §4.1–§4.2 notification rules | `docs/SMART-DIET-VERCEL-INDEPENDENCE-IMPLEMENTATION-PLAN.md` |
| Live migration statement hashes (MD5 + length, both projects) | Appendix A of this report |
| Live SQL Q1–Q7 + Auth dashboard checks | Appendix B of this report |
| Realtime runs 1–3, login tests, owner fix, redirect allow-list change | Appendix C of this report |
| Production schema baseline (validator PASS, re-run 21 Nov) | `supabase/baselines/production-schema.sql` + `scripts/validate-production-baseline.mjs` |
| Cloudflare independence + security review (10 checks PASS, no Critical/High) | `docs/cloudflare-independence-security-review-2026-11-21.md` (PR #85) |
| C1 restore test: design, bootstrap recipe, run evidence, equivalence verdict | `docs/supabase-restore-test-2026-11-21.md` (PR #86) + `.github/workflows/supabase-restore-test.yml` + `scripts/supabase-restore-test/` |
| C3 live marker isolation test (both directions, DB confirmation) | Appendix D of this report |
| C1 run-3 evidence summary + reproduction steps | Appendix E of this report |

**Method note.** This report synthesizes the four prompt deliverables and the parent's
browser-task results; it does not re-verify the prompts' claims from scratch. The three
claims verified independently in this prompt are: the harness has no "owner sanity check"
(§6.1), `api/index.ts` is a thin adapter (§3 item 3), and the `/tmp/drill` harness no
longer exists (O14). Every other claim is traced to its source doc or appendix above;
nothing in this report is asserted without a cited source.

**Evening update note.** The evening close-out (C1, C2, C3, review) was verified by
reading the C1 doc, the review doc, and the C3 execution-plan record in full, and by
checking CI on main HEAD `fb07f864` (combined state success; all 3 check runs +
Vercel green). The C3 evidence is the parent's browser-task results, recorded in
Appendix D with their caveats; the C1 evidence is the GitHub Actions run logs, cited
in Appendix E. Nothing in this update re-states a morning claim without a fresh
check where one was possible.

## 9. Change log

| Date (Cairo) | Change | Why | Evidence |
|---|---|---|---|
| 2026-11-21 (morning, 06:54–08:15) | Report created (PROMPT 6, PR #83) | Phase 1 closure assessment against the plan's §10 checklist | The four prompt deliverables + the parent's browser-task results (§8) |
| 2026-11-21 (evening) | C2 CLOSED BY DECISION; disposition updated to two remaining close-out items (C1, C3); §10 item 9 → CLOSED BY DECISION; gate 2 → CLOSED (Google half by decision, not by test); §7 decision 5 added; PROMPT 3 doc given a one-line pointer to this decision | Product-owner decision (سعيد, in chat): Google OAuth stays disabled for now; Email/Password is the approved authentication method | Decision only — no settings, credentials, code, or OAuth configuration changed; the provider remains disabled on both Supabase projects and the preview build flag stays `false` |
| 2026-11-21 (evening, final) | **PHASE 1 — CLOSED.** C1 CLOSED as a documented equivalent alternative (PR #86); C3 CLOSED by live test (Appendix D); gate 4 → CLOSED; §10 item 11 → PASS; §10 counts now 16 PASS, 0 PARTIAL, 1 CLOSED BY DECISION, 0 FAIL; §7 decisions 6–7 added; §6 corrections 5–7 added; §4 PIN-attempts paragraph corrected; O16 strengthened; O19 added; Appendices D–E added (PR_NUMBER_PLACEHOLDER) | All three close-out items evidenced: C1 run 3 green on the real Supabase stack, C3 live isolation PASS both directions, C2 decided; review (PR #85) found no unaddressed Critical/High; CI green on main HEAD `fb07f864` | Documentation only — no settings, credentials, code, or deployments changed by this update |

## Appendix A — Live migration statement hashes (2026-11-21 ~08:05)

Source: Supabase Dashboard SQL Editor, read-only query run on both projects by the
parent browser task:

```sql
SELECT version, name, md5(statements::text) AS statements_md5, length(statements::text) AS statements_len
FROM supabase_migrations.schema_migrations ORDER BY version;
```

The full statement text could not be captured (the Dashboard grid truncates each cell to
~100-character previews), so MD5 + length is the byte-exactness evidence. Note:
`length(statements::text)` counts the Postgres array-literal representation (`{"..."}`),
which is 4 characters longer than the raw statement text — e.g. the follow-up doc's
479/326-character counts for `add_patient_custom_tags` appear here as 483/330. The MD5s
are computed over the same array representation on both projects, so cross-project
comparison is exact.

**Cross-project result: 12 same-named migrations are byte-identical** (same MD5 + length)
on both projects — `atomic_clinic_payment_requests`,
`consolidate_clinic_subscription_update_policy`, `harden_payment_request_idempotency`,
`fix_payment_request_jsonb_keys`, `remove_duplicate_production_indexes`,
`secure_patient_subscription_gate`, `fail_closed_disabled_and_suspended_access`,
`restrict_disabled_patient_auxiliary_access`, `restrict_clinic_record_updates_to_owner`,
`revoke_public_helper_execute`, `replace_legacy_push_tokens`,
`harden_push_subscription_registration`. **2 differ:** `add_patient_custom_tags` (staging
330 vs production 483) and `revoke_excess_public_table_privileges` (staging 2264 vs
production 1810) — both explained in the PROMPT 4 doc (§5.4, §5.5).

### Staging — `smart-diet-v2-staging` (`dubevgijagqjgwcibqeo`) — 28 rows

| version | name | statements_md5 | len |
|---|---|---|---|
| 20261109061815 | staging_schema_reconciliation | af2649f826ce528f21c8bd62e1c206f9 | 15071 |
| 20261109062015 | performance_policy_tuning | 3c90c7d1b3b6754229494af25a1861da | 2573 |
| 20261109063122 | owner_atomic_operations | 474ebbb692139877bd3ebfe9e1f11ec6 | 6258 |
| 20261109063451 | owner_rpc_argument_validation | e3f88bc5e80a23da622014d1efb43750 | 1718 |
| 20261109063920 | owner_rpc_security_invoker | 59586d357b068048d8b4f77024909f98 | 361 |
| 20261109072358 | profiles_admin_only_visibility | 6cb09597bd2d6d96d92fe1c276f6ea04 | 590 |
| 20261109072730 | explicit_rls_all_platform_tables | dbd1cee905803161ccbbea25f7a9c830 | 805 |
| 20261109073443 | consolidate_clinic_subscription_policies | 5238c2dadb6308c961164a40006ac353 | 2927 |
| 20261109073735 | restrict_remaining_public_policies | 05ca7f21c167309205eb119a24394304 | 589 |
| 20261109074419 | consolidate_remaining_rls_policies | f51164bb3531578ef63b84095960c0d2 | 9156 |
| 20261109074506 | split_platform_config_read | 21824ed3a19bc9476774639fa4e33988 | 556 |
| 20261113020248 | atomic_clinic_payment_requests | 52440c3f191aa4d5b6506a9c8aa1bd01 | 10562 |
| 20261113020409 | consolidate_clinic_subscription_update_policy | c3a9d8c838d49cffc6920fb6a5705322 | 1651 |
| 20261113022823 | harden_payment_request_idempotency | b6e84f53cddcd777bc097965b86909d7 | 9710 |
| 20261113022850 | fix_payment_request_jsonb_keys | e7d69bb8172e36ea71ad3f697dd15a53 | 5532 |
| 20261113023420 | remove_duplicate_production_indexes | 139ec731e88f32574c4b751210d82582 | 1153 |
| 20261113023617 | secure_patient_subscription_gate | 99f2025be108415c881f521509ea34f0 | 2071 |
| 20261113023846 | fail_closed_disabled_and_suspended_access | 227c9ba93601e36d7ff5fe51ac0356fb | 1796 |
| 20261113023913 | restrict_disabled_patient_auxiliary_access | 31384f4676aac7acadfd5bf7d4bc8765 | 1542 |
| 20261113023952 | restrict_clinic_record_updates_to_owner | 1b1c20746b4b674ab872efbce30003fe | 569 |
| 20261113024145 | revoke_public_helper_execute | cc77b7c649e8efe521c746d95223656b | 361 |
| 20261114045406 | add_patient_custom_tags | 79ead22b46b97a952cd79ea648ecabb4 | 330 |
| 20261114064838 | clinic_appointments | 3d5f8d4c5198253ffdc5653ed598be09 | 9711 |
| 20261114064903 | appointments_created_by_idx | a5c9fba8eb99299ab14f3f6609921deb | 175 |
| 20261117144922 | replace_legacy_push_tokens | bc72ee3c108fc714e6a617a8538bce7c | 5397 |
| 20261117145227 | harden_push_subscription_registration | 18207fde65b327db780bd20ffbdb06d7 | 2506 |
| 20261117174650 | revoke_excess_public_table_privileges | 07387519d197c87fbf266a7d1959cd95 | 2264 |
| 20261118060141 | allow_chromium_web_push_endpoints | 3186830cceeec934058a395657bf1725 | 2378 |

### Production — `smart-diet-platform` (`lhjyshlxbsnesayivxpb`) — 16 rows

| version | name | statements_md5 | len |
|---|---|---|---|
| 20261109115448 | production_legacy_alignment | 3a2bcd9c40d37712d39816095e75baf4 | 45188 |
| 20261109115743 | drop_legacy_public_data_policies | bf6a616bba3f0918e9971d38a48b18cf | 508 |
| 20261113023307 | atomic_clinic_payment_requests | 52440c3f191aa4d5b6506a9c8aa1bd01 | 10562 |
| 20261113023310 | consolidate_clinic_subscription_update_policy | c3a9d8c838d49cffc6920fb6a5705322 | 1651 |
| 20261113023312 | harden_payment_request_idempotency | b6e84f53cddcd777bc097965b86909d7 | 9710 |
| 20261113023315 | fix_payment_request_jsonb_keys | e7d69bb8172e36ea71ad3f697dd15a53 | 5532 |
| 20261113023422 | remove_duplicate_production_indexes | 139ec731e88f32574c4b751210d82582 | 1153 |
| 20261113023618 | secure_patient_subscription_gate | 99f2025be108415c881f521509ea34f0 | 2071 |
| 20261113023848 | fail_closed_disabled_and_suspended_access | 227c9ba93601e36d7ff5fe51ac0356fb | 1796 |
| 20261113023914 | restrict_disabled_patient_auxiliary_access | 31384f4676aac7acadfd5bf7d4bc8765 | 1542 |
| 20261113023953 | restrict_clinic_record_updates_to_owner | 1b1c20746b4b674ab872efbce30003fe | 569 |
| 20261113024146 | revoke_public_helper_execute | cc77b7c649e8efe521c746d95223656b | 361 |
| 20261114045803 | add_patient_custom_tags | 6cf64f8260fc0e7b85aa5ce80d8444af | 483 |
| 20261117153100 | replace_legacy_push_tokens | bc72ee3c108fc714e6a617a8538bce7c | 5397 |
| 20261117153103 | harden_push_subscription_registration | 18207fde65b327db780bd20ffbdb06d7 | 2506 |
| 20261117165914 | revoke_excess_public_table_privileges | ded64f955604ab9098a27221eab3c227 | 1810 |

## Appendix B — Live SQL Q1–Q7 + Auth dashboard checks (2026-11-21 07:46–07:56)

Read-only queries run in the Supabase Dashboard SQL Editor by the parent browser task
(سعيد signed in via takeover). No writes, no settings changed, no secret values recorded.

| # | Query | Result |
|---|---|---|
| Q1 | Full stored statements, both projects | Version/name lists complete (staging 28, production 16). Statement text truncated in the grid — closed instead by the MD5 follow-up (Appendix A) |
| Q2 | Staging `patients.tags` end state | `tags` exists: `jsonb`, `NOT NULL`, default `'[]'::jsonb`; constraint `patients_tags_valid` = `CHECK ((jsonb_typeof(tags) = 'array' AND jsonb_array_length(tags) <= 20))`. Staging end state VERIFIED (closes PROMPT 4 §5.4) |
| Q3 | Staging `consents` indexes | 3 indexes: `consents_pkey` (id), `consents_patient_purpose_key` (patient_id, purpose), `consents_granted_by_idx` (granted_by). No `idx_consents_patient` — patient lookup is covered by the unique key |
| Q4 | `private.can_access_patient` body | Staging body captured in full (SECURITY DEFINER; owner → TRUE; admin/coach clinic-scoped; else self + active subscription). Production body captured in the follow-up task — logic identical (modulo formatting). CLOSED |
| Q5 | Staging `anon` SELECT on `platform_config` | `true` — the manual grant the drill seeds is confirmed live (supports PROMPT 4 §5.5) |
| Q6 | `fcm_tokens` on both projects | 0 rows on both — the legacy table is gone, confirmed |
| Q7 | Staging chromium migration version | `20261118060141` (`allow_chromium_web_push_endpoints`), 1 row |

**Auth dashboard checks (same task):** Staging Site URL = `http://localhost:3000`;
Staging Redirect URLs = `http://localhost:3000/**` only (workers.dev NOT present at that
time — added later, Appendix C). Production Site URL + Redirect URLs = Vercel only.
Google provider DISABLED on both projects, Client ID not configured, both fields empty.

## Appendix C — Browser test results (PROMPT 2 + PROMPT 3 handoff A)

Run on the preview (https://smart-diet-v2.saaedbelal.workers.dev) by the parent browser
tasks, 2026-11-21 07:58–08:12, with the three staging test accounts after a password
reset (Appendix B / §4). All writes were Staging-only synthetic data.

### C.1 Staging accounts as found

All 3 auth users existed (created 2026-11-02, last signed in the same day). 6 profiles:
Admin A + Coach A + Invitee in `clinic-a`; Patient A in `clinic-a`; Patient B in
`clinic-b`; Owner with EMPTY `clinic_id`. 2 clinics (`clinic-a` Test Clinic A,
`clinic-b` Test Clinic B). No user was created or deleted; no role or clinic move was
needed for the patients.

### C.2 Realtime isolation test (`/realtime-qa`)

| Run | Result | Patient A own | Patient A ← Clinic B | Patient B own | Patient B ← Clinic A |
|---|---|---|---|---|---|
| 1 | **FAIL** — "Realtime delivery or cross-clinic isolation did not match the expected result." No sign-in error shown | 0 | 0 | 0 | 0 |
| 2 | **PASS** — "PASS — cross-clinic Realtime isolation verified." | 1 | 0 | 1 | 0 |
| 3 | **PASS** — same message and counts as run 2 | 1 | 0 | 1 | 0 |

Tally: **2 of 3 PASS.** The run-1 all-zero failure is unexplained by anything shown on
the page and looks like a first-run timing/warm-up flake (the accounts had not signed in
since 2 Nov). Cross-clinic delivery was 0 in all three runs.

### C.3 Platform login tests (`/platform`)

| Step | Result |
|---|---|
| Patient A sign-in | PASS — dashboard loads (0 day records, no cloud plan, no daily records, adherence not set). Clinic-subscription banner shows «اشتراك العيادة انتهى» (O16) |
| Sign-out | PASS — login form («دخول المنصة») returns with empty fields |
| Patient A sign-in again, then reload | PASS — session restored; dashboard loads directly without the login form |
| Patient B sign-in | PASS — same empty cloud state; no Patient A data visible. **Caveat:** Patient A also had zero cloud data, so there was no distinguishing data that could have leaked — the isolation check is weak for cloud data (the strong isolation evidence is the Realtime cross=0 result + the PRIV-001 code proof). The «مزامنة بيانات جهازي» section showed the identical device-local note for both accounts — the unbound-snapshot aggregate display + confirmation gate documented in PROMPT 5 §3 item 5 (nothing was synced) |
| Owner sign-in (first attempt) | **FAILED to reach `/owner`** — «حسابك بلا ملف دور» (no role profile), because the owner profile's `clinic_id` was empty |
| Owner profile fix | `UPDATE public.profiles SET clinic_id='platform'` (Staging only) — succeeded, verified (1 row: `platform` / `owner` / `Owner`) |
| Owner sign-in (re-test) | **PASS** — redirected to `/owner`; owner dashboard loads real indicators (2 clinics, 1 active subscription, 1 in grace, 0 pending payment requests, 0 expiring within 30 days, 0 EGP approved payments in 6 months). Sign-out → owner gate shown («سجّل الدخول بحساب صاحب المنصة للمتابعة») |
| `/platform/register` | NOT TESTED — needs a fresh admin-created invitation (O10) |
| Password reset | NOT TESTED — `staging.test` addresses cannot receive mail (O10) |
| `/coach` with the real PIN | NOT TESTED by us — correct-PIN test belongs to سعيد (O4). Wrong PIN → 403 already proven live |

### C.4 Staging redirect allow-list change

`https://smart-diet-v2.saaedbelal.workers.dev/**` ADDED to the Staging Auth Redirect URLs
(Dashboard toast "Successfully added 1 URL"; total 2 URLs). `http://localhost:3000/**`
kept; Site URL unchanged (`http://localhost:3000`); Production not touched.

## Appendix D — C3 live marker isolation test (2026-11-21 evening)

Run on the preview (https://smart-diet-v2.saaedbelal.workers.dev) by the parent browser
tasks, 2026-11-21 21:49–22:08 Cairo, with the three staging test accounts after a
password reset (same bcrypt-UPDATE method as the morning; a new shared transient test
password, never stored). All writes were Staging-only synthetic data.

### D.1 Method — and a key discovery

`/platform` has **no day-log creation UI** — it is a read-only cloud view. Day logs are
created in the main app (`/`) and synced to the cloud from `/platform`. The markers
were therefore placed in two per-patient daily fields in the main app: the notes field
(«ملاحظات واستفسارات لـ أخصائي التغذية») and the symptom-details field («تفاصيل إضافية
حول الأعراض»), then synced. Marker texts: `PHASE1-ISOLATION-TEST-A-2026` and
`PHASE1-ISOLATION-TEST-B-2026`. The markers were left in place as evidence.

### D.2 Part 1 (21:49–22:03, 13 min) — A proven; B blocked by the binding guard

| Step | Result |
|---|---|
| Part A — accounts | All 3 accounts exist; password reset verified (updated_at 19:52:20 UTC; all sign-ins OK). clinic-a pro/active; clinic-b pro/grace (all dates NULL, payments []) |
| Step 3 — Patient A creates + syncs | **PASS.** Marker in both fields, breakfast marked, reload kept the marker; synced on /platform («نجحت جزئيًا» — 1 day + plan uploaded; fasting/alerts/milestones not uploaded). /platform shows 1 day log dated 2026-11-21. DB-verified: `public.day_logs` row for A, log_date 2026-11-21, created 19:54:56 UTC, notes + symNotes both hold the A marker |
| Step 4 — Patient B checks A, creates B | **A-nowhere PASS** (B's /platform: 0 day logs; page-text search found no A marker; B's main app opened fresh). **B's sync BLOCKED by the app's device-binding guard** («بيانات هذا الجهاز مرتبطة بحساب آخر… جهازًا/ملف متصفح منفصلًا») — the privacy protection working as designed (PROMPT 5 binding). B's marker exists locally only; DB confirms B has no day-log row yet |
| clinic-b subscription fix attempt | **Refused BY DESIGN.** SQL UPDATE refused — first a column error (`start_at`, not `start_date`), then ERROR 42501 from trigger `private.guard_clinic_subscription_payment_append()` (only an enabled clinic admin may append a payment request; even an admin may only change payments/updated_at). No bypass, trigger disable, or forged auth context was attempted. clinic-b unchanged (grace, NULL dates) |
| Step 5 — Patient A again | **PASS** (A's row + local marker present; B marker nowhere; deliberately no re-sync) |
| Step 6 — Patient B again | **PARTIAL** (B's local marker persists across sign-out/in; A marker nowhere; B's cloud side unverifiable — still 0 cloud logs) |

No leakage was observed in either direction in Part 1. The blocked remainder needed a
separate browser profile (the app's own instruction) for B.

### D.3 Part 2 (22:04–22:08, 3 min) — fresh browser profile "Patient B" — all steps PASS

| Step | Result |
|---|---|
| Step 1 — Patient B signs in | SUCCEEDED. Dashboard loaded as B with 0 cloud day logs initially. The grace banner («اشتراك العيادة انتهى — فترة السماح: —») showed but did not block the sync |
| Step 2 — B marker | SUCCEEDED. Marker in both fields, breakfast marked (1 of 4 meals); reload confirmed persistence in both fields |
| Step 3 — Sync | PARTIAL SUCCESS — exact message: «آخر حالة: نجحت جزئيًا — 2026-11-21T20:06:07.505Z — 1 يوم، والخطة رُفعت.» (fasting/alerts/milestones stayed local by design). The button was NOT disabled once the three consent boxes were ticked |
| Step 4 — B's cloud view + A-marker check | SUCCEEDED. /platform shows day-log count 1, latest log 2026-11-21. Full page-text search found the A marker NOWHERE (dashboard, day-log list, main app). The platform noted the device is now bound to B |
| Step 5 — Patient A cross-check | SUCCEEDED. A sees ONLY A's own day log (count 1, 2026-11-21); full page-text search found the B marker NOWHERE. A's sync section correctly showed the binding guard (device bound to B) with the sync button disabled — A did not sync |
| Step 6 — DB confirmation (separate task, main profile, 22:07–22:08) | `SELECT patient_id, log_date, created_at FROM public.day_logs WHERE log_date = '2026-11-21'` returned **2 rows**: Patient A (created 19:54:56 UTC) and Patient B (created 20:06:07 UTC). B's cloud row CONFIRMED |

### D.4 Verdict and caveats

**C3: PASS in both directions (cloud + local).** Each patient sees exactly their own
cloud day log; no cross-marker was found anywhere; the device-binding guard was proven
working in BOTH directions (it blocked B in profile 1 and A in profile 2).

Caveats, recorded honestly:
- **/platform renders date/weight/water only** — the marker text is not displayed on
  /platform for either patient (the day-log row does not expand). Cloud isolation is
  evidenced by per-patient counts/dates (each sees exactly their own 1 log) +
  page-text searches (no cross-marker anywhere) + the DB rows — not by visible marker
  text. The marker text IS visible in each patient's own main-app local fields.
- **Sync is "partial success" for both patients** — fasting, alert settings, and
  milestones stay on the device by design; that is the app's sync scope, not a
  failure.
- **clinic-b in grace did NOT block B's sync** — grace works normally, as designed.
  The SQL status change is refused by design (D.2); activation must go through the
  app's owner/admin payment flow.

### D.5 Reproduction

1. Reset the three staging test-account passwords via a bcrypt UPDATE in the Staging
   SQL Editor (transient test password; never stored).
2. In browser profile 1, sign in as Patient A on the preview, enter marker A in the
   main app's notes + symptom-details fields, mark a meal, reload, sync on
   /platform (tick all three consent boxes), and confirm the cloud log appears.
3. In browser profile 1, sign in as Patient B: confirm 0 cloud logs and no A marker
   anywhere (B's sync will be blocked by the device-binding guard — expected).
4. In a FRESH browser profile, sign in as Patient B, enter marker B, sync, and
   confirm the cloud log appears and the A marker is nowhere.
5. In the same fresh profile, sign in as Patient A: confirm only A's own log is
   shown and the B marker is nowhere.
6. In the Staging SQL Editor (read-only): `SELECT patient_id, log_date, created_at
   FROM public.day_logs WHERE log_date = '2026-11-21' ORDER BY created_at;` —
   expect one row per patient.

## Appendix E — C1 restore test: run evidence + reproduction (2026-11-21 evening)

Full design, bootstrap recipe, and equivalence verdict:
`docs/supabase-restore-test-2026-11-21.md` (PR #86). This appendix is the
evidence summary for the closure record.

### E.1 Run evidence

Workflow `Supabase Restore Test` (`.github/workflows/supabase-restore-test.yml`,
manual dispatch, Supabase CLI 3.2.0 pinned, PostgreSQL 17.12 on the local stack),
input `chain: both`, on branch `feat/supabase-restore-test-2026-11-21` (PR #86).

| Run | Date (UTC) | Conclusion | What happened |
|---|---|---|---|
| [44944411061](https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44944411061) | 2026-11-21 20:08 | failure | Both chains failed at schema verification — an arg-parsing bug in `verify-schema.mjs` (a missing optional flag made the script read `'--chain'` as the database URL). Fixed in all four scripts |
| [44944819242](https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44944819242) | 2026-11-21 20:13 | failure | Schema verification PASSED on both chains (production 18/18, staging 25/25). Services step failed on both: every services test passed, then the optional cleanup `vault.delete_secret(name)` threw `42883` (no such overload — the function takes a secret id, not a name). Fix: removed the cleanup (the database is throwaway) |
| [44945186144](https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44945186144) | 2026-11-21 20:18 | **success** | **All jobs green.** Production: schema 18/18 PASS, services 10/10 PASS. Staging: schema 25/25 PASS, services 10/10 PASS. Zero FAIL lines in either job log |

Run 3 detail: production schema counts exactly `tables=11, policies=40, indexes=23,
routines=19, triggers=2, rls_tables=11, constraints=33`; staging exactly `tables=12,
policies=43, indexes=27, routines=20, triggers=2, rls_tables=12, constraints=44`.
Services 10/10 on each chain: Realtime publication contains `public.profiles`; 2 users
created via the GoTrue Admin API; both signed in with email + password; each reads
only their own profile row via PostgREST; anon reads none; both Realtime channels
joined; the owner received the UPDATE (on attempt 2 — the known cold-start flake)
and the other user received nothing; the Vault secret round-tripped;
`get_push_signing_config` present.

Observations (not failure causes): Realtime cold-start flake (first delivery slow,
arrived on attempt 2 — the same first-run flake seen on the managed preview);
transient Docker Hub rate limiting during image pulls (CLI retried, `supabase start`
succeeded every time); `supabase_imgproxy_*` and `supabase_pooler_*` reported stopped
(no test uses them).

### E.2 What was NOT tested (residual gap)

Managed dashboard provisioning, managed extension configuration, project-level
settings (redirect URLs, Auth providers, SMTP), network/SSL, data migration (no real
data restored), and the live projects (never touched by design). A restore into a
managed disposable project would close the provisioning gap fully — deliberately not
done (a third free project needs a new org or ~$25/mo Pro and adds no restore
evidence). See the C1 doc §8–§9.

### E.3 Reproduction

- **Full test (GitHub Actions):** dispatch the workflow (Actions → Supabase
  Restore Test → Run workflow), optionally for one chain. Requires no secrets
  and no Supabase project.
- **Local pre-check (no Docker):** `npm ci`, then
  `node scripts/supabase-restore-test/smoke-pglite.mjs --chain both`
  (expected: production 18/18 PASS, staging 25/25 PASS).
- **Local workdir build (no stack start):**
  `node scripts/supabase-restore-test/build-workdir.mjs --chain staging --workdir /tmp/restore-staging`
  (needs the Supabase CLI on PATH; `supabase start` needs Docker).
