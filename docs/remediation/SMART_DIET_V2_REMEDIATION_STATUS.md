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
