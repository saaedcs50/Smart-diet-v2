# Smart Diet V2 — Audit Remediation Status

**Audit:** SMART_DIET_V2_DEEP_AUDIT_REPORT.md (2026-10-31)
**Baseline:** `ec47cdfec00907add0082bb9939881724f0c384b`
**Branch:** `fix/smart-diet-v2-audit-remediation`

| Finding ID | Title | Status | Evidence |
|---|---|---|---|
| SDV2-INT-001 | Missing CRUD grants | VERIFIED | Grants applied via dashboard; authenticated/service_role have 10/10 |
| SDV2-INT-002 | Sync stubs throw NOT_MIGRATED | FIXED_UNVERIFIED | saveConsent implemented; consents table created |
| SDV2-INT-003 | Invitation RLS mismatch | VERIFIED | 3 policies added: inv_invitee_read, profiles_self_insert, inv_invitee_consume |
| SDV2-INT-004 | VAPID signature bug (DER vs raw) | VERIFIED | v3 deployed with raw r||s fix |
| SDV2-SEC-001 | Missing disabled/subscription checks | VERIFIED | v3 deployed with checks |
| SDV2-CONF-001 | No migrations in repo | FIXED_UNVERIFIED | supabase/migrations/ structure created |
| SDV2-CONF-002 | Edge Function not in repo | VERIFIED | supabase/functions/notify/index.ts committed |
| SDV2-SEC-002 | Coach PIN local fallback | FIXED_UNVERIFIED | COACH_LOCAL_ONLY now dev-only |
| SDV2-SEC-003 | In-memory rate limiting | FIXED_UNVERIFIED | Fail-closed in production |
| SDV2-SEC-004 | SECURITY DEFINER search_path | DOCUMENTED | SQL in docs/remediation/SEC-004-functions-hardening.sql.md |
| SDV2-INT-005 | No Realtime publication | FIXED_UNVERIFIED | Retry with backoff added to auth.tsx |
| SDV2-BUG-001 | Date.setMonth rollover | VERIFIED | addMonthsLocked + 5 tests pass |
| SDV2-BUG-002 | Timeline zero logic | FIXED_UNVERIFIED | Returns non-estimable for zero/inconsistent |
| SDV2-CLIN-001 | REE equation labeling | VERIFIED | Separated Kholoud/Mifflin functions, added metadata labels, 5 new tests pass. Default unchanged (needs clinical approval). |
| SDV2-CLIN-002 | Water estimate constraints | VERIFIED | Added isEstimate flag + Arabic warning for pregnancy/kidney/heart/fluid-restriction cases. Default values unchanged. |
| SDV2-PWA-001 | No offline app shell | VERIFIED | Added fetch handler: cache-first for assets, network-first for navigation with offline fallback. Push handling preserved. |
| SDV2-DATA-001 | Backup PBKDF2 unbounded | FIXED_UNVERIFIED | Iterations bounded 1k-1M |
| SDV2-DATA-002 | Backup restore no validation | FIXED_UNVERIFIED | Validates sections before write |
| SDV2-PRIV-001 | Local data not isolated by user | DOCUMENTED | Analysis in docs/remediation/PRIV-001-analysis.md |
| SDV2-UX-001 | Errors hidden as null/[] | VERIFIED | Added logDbError() with context; getClinic/getPatient/listDayLogEntries now log permission failures instead of silent null. |
| SDV2-TEST-001 | No Supabase RLS tests in CI | VERIFIED | Added rls-policy-check job to quality.yml: validates 11 tables in migration, Edge Function source present. |
| SDV2-OWNER-001 | Clinic provisioning not atomic | DOCUMENTED | linkClinicOwner added; RPC documented |
| SDV2-OWNER-002 | Payment race condition | DOCUMENTED | Analysis in docs/remediation/OWNER-002-analysis.md |
| SDV2-SEC-005 | TRUNCATE overgrant | VERIFIED | Revoked via dashboard |
| SDV2-CONF-003 | Stale Cloudflare/Firebase files | VERIFIED | fcm-worker/ removed (PR #32). Analysis in CONF-003-analysis.md: firebase.json, firebase-messaging-sw.js, firebase.ts safe to remove (zero refs); firestore.rules kept for CI test:rules job. |
| SDV2-CLIN-003 | BMI wording | VERIFIED | Added 'مؤشر فحص وليس تشخيصًا' disclaimer to all BMI labels; softened 'مثالي تمامًا' → 'في النطاق الطبيعي', 'سمنة مفرطة' → 'من الدرجة الثانية فأعلى — استشر مختصًا'. |
| SDV2-PERF-001 | Performance advisor warnings | VERIFIED | INFO only — documented. No code changes needed. |

---

## Post-PR33 Independent Audit (2026-10-31) — Follow-up Fixes

**Branch:** `fix/post-pr33-audit`
**Audit:** SMART_DIET_V2_POST_PR33_INDEPENDENT_AUDIT_2_pg40.md

| Finding ID | Title | Status | Evidence |
|---|---|---|---|
| SDV2-SEC-004 | SECURITY DEFINER hardening | SQL_READY | `supabase/migrations/20261101000000_p0_security_fixes.sql` — ALTER FUNCTION SET search_path='' for all 4 functions; REVOKE EXECUTE on clinic_sub_active from anon/authenticated. Awaiting dashboard application. |
| SDV2-SEC-005 | TRUNCATE on consents | SQL_READY | REVOKE TRUNCATE ON public.consents FROM anon, authenticated + loop over all public tables in migration. |
| P0-1 | profiles_self_insert escalation | SQL_READY | Policy replaced: self-insert restricted to role='patient' AND disabled=false. Staff roles via server-side only. |
| P0-2 | inv_invitee_consume escalation | SQL_READY | Policy narrowed + trigger `enforce_invitation_immutable_cols()` prevents role/clinic_id/created_by/email mutation. |
| P0-3 | config_read overbroad | SQL_READY | Replaced with config_read_public (value->>'public'='true' only). |
| SDV2-CONF-001 | Executable migration | FIXED | `supabase/migrations/20261101000000_p0_security_fixes.sql` is real executable SQL (not comments). |
| SDV2-INT-002 | Sync NOT_MIGRATED calls | FIXED | Removed saveActiveFasting/saveNotificationSettings/saveMilestones/saveSeasonal/saveShoppingList from SyncWriters and migrateLocalToCloud. Report now has unsupportedSections[] listing skipped sections explicitly. Tests updated. |
| SDV2-UX-001 | Incomplete error logging | FIXED | Added logDbError() to getDayLog, listDayLogs, listClinicPatients, listClinicPatientEntries, listClinicStaffEntries, listDoctorPatients. |
| SDV2-SEC-003 | getCoachGuardStore placement | FIXED | Moved inside try block in handleCreateSession; GuardUnavailableError now caught by guardFailure → 503. |
| SDV2-DATA-001 | Backup size validation | FIXED | decryptBackupJSON now checks byte size (60MB max) before JSON.parse; validates salt/iv/data field lengths. |

**Tests:** 278 passed, 3 skipped. TypeScript clean.

**Note:** The P0 SQL migration must be applied via Supabase Dashboard SQL Editor (direct DB connections blocked). Verification queries included in migration file.

---

## PR34 Independent Review (2026-10-31) — Follow-up Fixes

**Branch:** `fix/pr34-audit-followup`
**Audit:** SMART_DIET_V2_PR34_INDEPENDENT_REVIEW_1_vyn9.md

| Finding ID | Title | Status | Evidence |
|---|---|---|---|
| P1-2 | Sync UI partial state | FIXED | `SyncState` now includes `'partial'`; `SyncStatus.unsupportedSections` persisted. `SyncSection.run()` sets `partial` when errors=0 but unsupportedSections>0. UI shows «نجحت جزئيًا» + Arabic labels of skipped sections (الصيام النشط، إعدادات التنبيهات، المعالم، القالب الموسمي، قوائم التسوق). New test for partial round-trip. |
| P1-3 | Payment methods public marker | FIXED | `savePaymentMethods()` now writes `public: 'true'` inside the JSONB value, matching the `config_read_public` policy predicate `(value ->> 'public') = 'true'`. Clinic users can read payment instructions; private settings stay hidden. |
| P1-4 | Migration drift documentation | FIXED | `docs/remediation/PR34-DRIFT-ANALYSIS.md` documents: (1) live profiles_self_insert allows patient/coach/admin vs committed patient-only; (2) live trigger `enforce_invitation_consume` vs committed `enforce_invitation_immutable_cols` (+ re-open blocked live); (3) empty migration history; (4) manual dashboard process. Includes reconciliation recommendation + verification queries. |

**Note:** P0-1 (staff self-insert), P0-2 (PUBLIC execute on helpers), and P1-1 (invitation re-open) from the PR34 review require live-database decisions/changes beyond code fixes and are NOT addressed in this branch — they need owner confirmation on the intended policy before reconciliation.
