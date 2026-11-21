# Migration Reconciliation — Production vs Staging (PROMPT 4)

**Date:** 21 November 2026
**Repository:** `saaedcs50/Smart-diet-v2` (main `6587b05e`)
**Production:** `smart-diet-platform` (`lhjyshlxbsnesayivxpb`) — 16 ledger records
**Staging:** `smart-diet-v2-staging` (`dubevgijagqjgwcibqeo`) — 28 ledger records
**Sources:** `supabase/migrations/` (28 files on main), `supabase/baselines/production-schema.sql`,
`docs/phase-1-closure-followup-2026-11-21.md` (21 Nov, incl. its exact source-to-live comparison),
PR #75 audit `docs/phase-1-supabase-data-independence.md` (17 Nov, ledger version/name tables),
PR #71 (appointments files), PR #75 branch (revoke file), PR #76 (chromium file),
and a clean-room PGlite restore drill run 21 Nov (this document, §6).

No live database was written to. No migration-history record was created, renamed, or
fabricated. Ledger contents below are quoted from the 17 Nov audit and the 21 Nov follow-up;
byte-level statement text still needs the read-only live queries listed in §8.

## 1. Verdicts

| Question | Answer |
|---|---|
| Can main's 28 migration files rebuild Production from empty? | **No.** The first file fails immediately (`relation "public.profiles" does not exist`). The 7 core tables, 9 legacy helper functions, 7 legacy policies and legacy grants/indexes have no `CREATE` source in Git — they came from a legacy restore (Production) / manual Dashboard provisioning (Staging). |
| Can main's 28 files rebuild Staging from empty? | **No.** Same bootstrap gap, plus 4 needed files are not on main (2 appointments files on PR #71, the revoke file on PR #75's branch, the chromium file on PR #76). |
| Does the Production chain converge to the live schema given the legacy seed? | **Yes — exactly.** With a legacy seed reconstructed from the baseline snapshot, all 16 Production chain files apply cleanly and the result matches the baseline object-for-object: 11 tables, 40 policies, 23 indexes, 19 routines, 2 triggers, 87 constraints (validator's filtered count: 33), identical columns, policies, functions, indexes, triggers and function ACLs. Remaining diffs: Supabase-managed `service_role` ACL letters and one cosmetic `CHECK` parenthesisation (§6.4). |
| Does the Staging chain converge to the known Staging inventory given the manual seed + branch files? | **Yes.** All 28 files apply cleanly; all 15 staging checks pass: 12 tables, 43 policies, 20 routines, 3 triggers, `consents.updated_at` present, `adherence_scores.note NOT NULL DEFAULT ''`, `day_logs.id` identity, `consents_patient_purpose_key`, `day_logs_patient_id_log_date_uidx`, fcm endpoint allowed, appointments table + policies + function + trigger present. |
| Is the Production baseline snapshot itself valid? | **Yes.** The repo's PGlite validator (`scripts/validate-production-baseline.mjs`) was re-run locally 21 Nov: PASS (11/40/23/19/2/11/33). It is the only self-contained Production schema source. There is no Staging baseline snapshot. |
| Is the restore story closed? | **Partly.** Clean-room rebuild in real PostgreSQL 17 (PGlite) is proven for both chains. A disposable-Supabase-project restore (Auth/Vault/Realtime prerequisites) is still untested, and 7 read-only live queries remain (§8). Docker could not be used here: the daemon runs but containers cannot start in this sandbox (§6.1). |

## 2. Ledger maps

### 2.1 Production — 16 records

Ledger versions are from the 17 Nov audit (15 records) + the 21 Nov follow-up
(`20261117165914`). Version IDs differ from Git filenames for every Nov 13/14/17 change:
the same change was applied to Production through Supabase tooling under a new timestamp.

| # | Ledger version | Name | Git file (main unless noted) | Version match | Content verdict |
|---|---|---|---|---|---|
| 1 | 20261109115448 | production_legacy_alignment | `20261109115448_production_legacy_alignment.sql` | ✅ same | Not byte-compared (see §4) |
| 2 | 20261109115743 | drop_legacy_public_data_policies | `20261109115743_drop_legacy_public_data_policies.sql` | ✅ same | Not byte-compared |
| 3 | 20261113023307 | atomic_clinic_payment_requests | `20261113020248_atomic_clinic_payment_requests.sql` | ❌ differs | ✅ exact match (21 Nov) |
| 4 | 20261113023310 | consolidate_clinic_subscription_update_policy | `20261113020409_consolidate_clinic_subscription_update_policy.sql` | ❌ differs | ⚠️ file has 1 extra DROP (end-state identical, §5.1) |
| 5 | 20261113023312 | harden_payment_request_idempotency | `20261113021000_harden_payment_request_idempotency.sql` | ❌ differs | ✅ exact match |
| 6 | 20261113023315 | fix_payment_request_jsonb_keys | `20261113021200_fix_payment_request_jsonb_keys.sql` | ❌ differs | ✅ exact match |
| 7 | 20261113023422 | remove_duplicate_production_indexes | `20261113024000_remove_duplicate_production_indexes.sql` | ❌ differs | ✅ exact match |
| 8 | 20261113023618 | secure_patient_subscription_gate | `20261113025000_secure_patient_subscription_gate.sql` | ❌ differs | ✅ exact match |
| 9 | 20261113023848 | fail_closed_disabled_and_suspended_access | `20261113025500_fail_closed_disabled_and_suspended_access.sql` | ❌ differs | ✅ exact match |
| 10 | 20261113023914 | restrict_disabled_patient_auxiliary_access | `20261113025700_restrict_disabled_patient_auxiliary_access.sql` | ❌ differs | ⚠️ live also changed `fcm_tokens` policy (moot now, §5.2) |
| 11 | 20261113023953 | restrict_clinic_record_updates_to_owner | `20261113025800_restrict_clinic_record_updates_to_owner.sql` | ❌ differs | ✅ exact match |
| 12 | 20261113024146 | revoke_public_helper_execute | `20261113025900_revoke_public_helper_execute.sql` | ❌ differs | ✅ exact match |
| 13 | 20261114045803 | add_patient_custom_tags | `20261114045406_add_patient_custom_tags.sql` | ❌ differs | ⚠️ all three texts differ; prod end state verified (§5.4) |
| 14 | 20261117153100 | replace_legacy_push_tokens | `20261117140700_replace_legacy_push_tokens.sql` | ❌ differs | ⚠️ live larger, different opening SQL (§5.3) |
| 15 | 20261117153103 | harden_push_subscription_registration | `20261117150000_harden_push_subscription_registration.sql` | ❌ differs | ✅ exact match |
| 16 | 20261117165914 | revoke_excess_public_table_privileges | PR #75 branch only: `20261117170000_revoke_excess_public_table_privileges.sql` | ❌ differs | ⚠️ file 2,814 chars vs live 1,806 (§5.5) |

### 2.2 Staging — 28 records

Ledger versions are from the 17 Nov audit (26 records) + the 21 Nov follow-up
(`20261117174650` revoke; 28th record is the PR #76 chromium change).

| # | Ledger version | Name | Git file (main unless noted) | Version match | Content verdict |
|---|---|---|---|---|---|
| 1–11 | 20261109061815 … 20261109074506 | Nov 9 reconciliation/security sequence (11 files) | same filenames on main | ✅ same (all 11) | Not byte-compared (see §4) |
| 12 | 20261113020248 | atomic_clinic_payment_requests | same filename | ✅ same | ✅ exact match |
| 13 | 20261113020409 | consolidate_clinic_subscription_update_policy | same filename | ✅ same | ⚠️ file has 1 extra DROP (§5.1) |
| 14 | 20261113022823 | harden_payment_request_idempotency | `20261113021000_…` | ❌ differs | ✅ exact match |
| 15 | 20261113022850 | fix_payment_request_jsonb_keys | `20261113021200_…` | ❌ differs | ✅ exact match |
| 16 | 20261113023420 | remove_duplicate_production_indexes | `20261113024000_…` | ❌ differs | ✅ exact match |
| 17 | 20261113023617 | secure_patient_subscription_gate | `20261113025000_…` | ❌ differs | ✅ exact match |
| 18 | 20261113023846 | fail_closed_disabled_and_suspended_access | `20261113025500_…` | ❌ differs | ✅ exact match |
| 19 | 20261113023913 | restrict_disabled_patient_auxiliary_access | `20261113025700_…` | ❌ differs | ⚠️ live also changed `fcm_tokens` (§5.2) |
| 20 | 20261113023952 | restrict_clinic_record_updates_to_owner | `20261113025800_…` | ❌ differs | ✅ exact match |
| 21 | 20261113024145 | revoke_public_helper_execute | `20261113025900_…` | ❌ differs | ✅ exact match |
| 22 | 20261114045406 | add_patient_custom_tags | same filename | ✅ same | ⚠️ all three texts differ; staging end state unverified (§5.4) |
| 23 | 20261114064838 | clinic_appointments | PR #71 only | ✅ same (PR #71) | Not byte-compared |
| 24 | 20261114064903 | appointments_created_by_idx | PR #71 only | ✅ same (PR #71) | Not byte-compared |
| 25 | 20261117144922 | replace_legacy_push_tokens | `20261117140700_…` | ❌ differs | ⚠️ live larger, different opening SQL (§5.3) |
| 26 | 20261117145227 | harden_push_subscription_registration | `20261117150000_…` | ❌ differs | ✅ exact match |
| 27 | 20261117174650 | revoke_excess_public_table_privileges | PR #75 branch only: `20261117170000_…` | ❌ differs | ⚠️ file 2,814 chars vs live 2,260 (§5.5) |
| 28 | (not recorded in follow-up) | allow_chromium_web_push_endpoints | PR #76: `20261118060141_allow_chromium_web_push_endpoints.sql` | unknown | ⚠️ file 2,492 chars vs live 2,350 (§5.6) |

### 2.3 Version-ID summary (28 files on main)

- Version matches the Staging ledger only: 14 files (11 Nov-9 + `020248` + `020409` + `14045406`).
- Version matches the Production ledger only: 2 files (the legacy-alignment pair).
- Version matches neither ledger: 10 files (8 Nov-13 + 2 push files).
- In neither ledger: 2 files — `20261031000000_baseline.sql` (comment-only placeholder, no DDL)
  and `20261101000000_p0_security_fixes.sql` (see §3).
- No file's version matches both ledgers. Version IDs are an application-time artefact of
  Supabase tooling, not a content signal: 12 shared changes match by statement MD5 across
  environments despite different version IDs (follow-up §2).

## 3. File-by-file record (28 files on main + 4 branch files)

"Exact match" means the 21 Nov follow-up's trimmed comparison of file text vs the live
stored statement. "End state" is judged by this drill and/or the baseline snapshot.

| File | Size | What it does | Ledger | Content | End state |
|---|---|---|---|---|---|
| `20261031000000_baseline.sql` | 2,686 | Comment-only object inventory; creates nothing | neither | n/a (no DDL) | Placeholder only — must never be replayed |
| `20261101000000_p0_security_fixes.sql` | 7,714 | Post-PR33 P0 hardening: 3 policies, `enforce_invitation_immutable_cols` + trigger, 6 REVOKEs | neither | n/a | Fully superseded: its 3 policies were later dropped/replaced; its function/trigger are absent from the baseline. Historical record, not a chain link |
| `20261109061815_staging_schema_reconciliation.sql` | 14,533 | Staging: creates `adherence_configs/scores`, `consents`; 17 policies; 5 indexes; 2 functions | staging ✅ same version | not byte-compared | ✅ drill converges (staging) |
| `20261109062015_performance_policy_tuning.sql` | 2,571 | Recreates 6 policies (perf); 3 indexes | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109063122_owner_atomic_operations.sql` | 6,261 | `owner_create_clinic_with_owner`, `owner_review_clinic_payment` | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109063451_owner_rpc_argument_validation.sql` | 1,714 | DO-block rewrite of `owner_review_clinic_payment` (NULL checks, note length) | staging ✅ | not byte-compared | ✅ drill converges; prod gets the same checks baked into the alignment file |
| `20261109063920_owner_rpc_security_invoker.sql` | 357 | Owner RPCs → SECURITY INVOKER | staging ✅ | not byte-compared | ✅ drill converges; prod alignment file does the same |
| `20261109072358_profiles_admin_only_visibility.sql` | 586 | `profiles_admin_clinic_read`; ALTERs legacy `profiles_owner_all` | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109072730_explicit_rls_all_platform_tables.sql` | 744 | ENABLE RLS on 10 tables | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109073443_consolidate_clinic_subscription_policies.sql` | 2,923 | 9 clinic/subscription policies, drops 6 | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109073735_restrict_remaining_public_policies.sql` | 585 | ALTERs 6 legacy policies TO authenticated | staging ✅ | not byte-compared | ✅ drill converges (all 6 policies later dropped) |
| `20261109074419_consolidate_remaining_rls_policies.sql` | 9,152 | 16 consolidated policies, drops 19 | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109074506_split_platform_config_read.sql` | 552 | `config_select_anon` + `config_select_authenticated` | staging ✅ | not byte-compared | ✅ drill converges |
| `20261109115448_production_legacy_alignment.sql` | 44,593 | Prod bridge: replays the staging Nov-9 sequence onto the restored legacy schema; 51 policies, 8 functions, 3 tables (IF NOT EXISTS) | prod ✅ same version | not byte-compared | ✅ drill converges (prod) |
| `20261109115743_drop_legacy_public_data_policies.sql` | 442 | Drops 3 legacy `*_access` policies | prod ✅ | not byte-compared | ✅ drill converges |
| `20261113020248_atomic_clinic_payment_requests.sql` | 10,558 | Payment-request RPCs + guard trigger + 1 policy | both (versions differ) | ✅ exact | ✅ |
| `20261113020409_consolidate_clinic_subscription_update_policy.sql` | 1,735 | Single `subscriptions_update_authorized` policy | both (versions differ) | ⚠️ extra DROP in file | ✅ end-state identical (§5.1) |
| `20261113021000_harden_payment_request_idempotency.sql` | 9,706 | Payment idempotency (RPC redefinitions) | both (versions differ) | ✅ exact | ✅ |
| `20261113021200_fix_payment_request_jsonb_keys.sql` | 5,528 | JSONB key fix in guard function | both (versions differ) | ✅ exact | ✅ |
| `20261113024000_remove_duplicate_production_indexes.sql` | 1,149 | Conditional drops of 4 duplicate indexes | both (versions differ) | ✅ exact | ✅ (conditional logic verified by drill) |
| `20261113025000_secure_patient_subscription_gate.sql` | 2,067 | `get_clinic_subscription_gate` (private DEFINER + public INVOKER) | both (versions differ) | ✅ exact | ✅ |
| `20261113025500_fail_closed_disabled_and_suspended_access.sql` | 1,792 | Fail-closed `caller_role`/`caller_clinic_id`/`clinic_sub_active` (both schemas) | both (versions differ) | ✅ exact | ✅ |
| `20261113025700_restrict_disabled_patient_auxiliary_access.sql` | 1,161 | Recreates 3 consents policies with disabled check | both (versions differ) | ⚠️ live also changed `fcm_tokens` | ✅ end-state identical (§5.2) |
| `20261113025800_restrict_clinic_record_updates_to_owner.sql` | 565 | `clinics_owner_update` replaces `clinics_update_authorized` | both (versions differ) | ✅ exact | ✅ |
| `20261113025900_revoke_public_helper_execute.sql` | 357 | REVOKEs public `caller_role`/`caller_clinic_id` EXECUTE | both (versions differ) | ✅ exact | ✅ |
| `20261114045406_add_patient_custom_tags.sql` | 681 | `patients.tags` jsonb + `patients_tags_valid` + COMMENT | both (versions differ on prod) | ⚠️ all three differ | ✅ prod verified via baseline; staging unverified (§5.4) |
| `20261117140700_replace_legacy_push_tokens.sql` | 4,281 | Creates `push_subscriptions` + 2 policies + `claim_push_subscription` (DEFINER) + `get_push_signing_config` | both (versions differ) | ⚠️ live larger, different opening | ✅ end-state identical for push objects (§5.3) |
| `20261117150000_harden_push_subscription_registration.sql` | 2,492 | INSERT policy + `claim_push_subscription` → INVOKER | both (versions differ) | ✅ exact | ✅ |
| `20261117170000_revoke_excess_public_table_privileges.sql` (PR #75 branch) | 2,815 | REVOKE MAINTAIN/REFERENCES/TRIGGER from anon/authenticated + default privileges, with assertions | both (versions differ) | ⚠️ file vs prod 1,806 vs staging 2,260 | ✅ least-privilege end state verified live on both (§5.5) |
| `20261114064838_clinic_appointments.sql` (PR #71) | 9,789 | `appointments` table (12 cols) + 3 policies + `validate_appointment_booking` + trigger + 3 indexes | staging ✅ same version | not byte-compared | ✅ drill converges (staging) |
| `20261114064903_appointments_created_by_idx.sql` (PR #71) | 171 | `appointments_created_by_idx` | staging ✅ same version | not byte-compared | ✅ drill converges |
| `20261118060141_allow_chromium_web_push_endpoints.sql` (PR #76) | 2,493 | fcm.googleapis.com endpoint allowed; `claim_push_subscription` redefined (INVOKER, DO NOTHING) | staging only | ⚠️ file 2,492 vs live 2,350 | ✅ drill converges; separate notification fix, not a Phase 1 gate (§5.6) |

Counts: 9 of the 13 compared core files match live SQL exactly; 3 differ with identical
end state; 1 (`add_patient_custom_tags`) differs with staging end state still unverified.
13 further files (11 Nov-9 + 2 alignment) were never byte-compared — version/name only.

## 4. What the files do NOT contain (the bootstrap gap)

No file in the repository creates these — they came from manual Dashboard provisioning
(Staging) or a legacy restore (Production):

- **7 core tables:** `profiles`, `clinics`, `clinic_subscriptions`, `platform_config`,
  `invitations`, `patients`, `day_logs`. Only 5 tables are created by migration files:
  `adherence_configs`, `adherence_scores`, `consents` (Nov-9 files),
  `push_subscriptions` (Nov-17), `appointments` (PR #71).
- **9 legacy helper functions:** `public` + `private` `caller_role`, `caller_clinic_id`,
  `clinic_sub_active`, `can_access_patient`, and `public.enforce_invitation_consume`.
  The chains *require* them to pre-exist: the alignment file `REVOKE`s EXECUTE on the four
  public helpers (lines 1195–1198, no `IF EXISTS`), and the staging reconciliation file's
  policies call the four private helpers without defining them. Three of them
  (`public.can_access_patient`, `public.clinic_sub_active`, `public.enforce_invitation_consume`)
  are never defined by any migration file — the baseline snapshot is the only record of
  their bodies.
- **7 legacy policies** the chains `ALTER` (no `IF EXISTS`): `profiles_owner_all`,
  `inv_owner_all`, `inv_staff_read`, `patients_admin_write`, `patients_owner_all`,
  `patients_admin_read`, `config_owner_write`. All are dropped by the later consolidation,
  so their original predicates are unrecoverable — and irrelevant to the end state.
- **Legacy indexes** `idx_consents_patient`, `idx_day_logs_patient` and the three dropped
  duplicates (`idx_adherence_scores_patient`, `idx_patients_clinic`, `idx_patients_invited_by`).
- **Legacy grants**, notably `anon SELECT` on `platform_config` (only the Production
  alignment file records it, line 1187; no Staging file does — see §5.5).
- **The `fcm_tokens` table lifecycle**: it appears in *no* Git file, yet the live Nov-13
  `restrict_disabled_patient_auxiliary_access` statement changed its policy, and the table
  is gone from Production by the Nov-17 baseline (0 mentions). Its creation and drop exist
  only in live ledger statements (§5.3).

## 5. Drift resolutions

### 5.1 `consolidate_clinic_subscription_update_policy` — RESOLVED (end-state identical)

The file drops three policies (`subscriptions_admin_payment_request_update`,
`subscriptions_owner_update`, `subscriptions_update_authorized`) before recreating
`subscriptions_update_authorized`; the live statement (identical in both environments)
drops only the first two. The extra DROP makes the file idempotent (re-runnable); the
`CREATE POLICY` body is the same. End state identical. No action; the file is the safer
revision. Do not "fix" the file to match history — that would remove the idempotency.

### 5.2 `restrict_disabled_patient_auxiliary_access` — RESOLVED (moot)

The live statement (identical in both environments) additionally changed a policy on the
legacy `fcm_tokens` table; the file only recreates the three `consents` policies.
`fcm_tokens` no longer exists in Production (0 mentions in the baseline) and was replaced
by `push_subscriptions` on 17 Nov. End state identical today. The file is the correct
current record; the `fcm_tokens` clause is unrecoverable history (see §4).

### 5.3 `replace_legacy_push_tokens` — PARTIALLY RESOLVED (end state identical; prologue unconfirmed)

The live stored statement is larger than the 4,281-byte file and begins with different SQL
(same in both environments). The file contains no `DROP TABLE`, yet `fcm_tokens` — present
on 13 Nov — is gone by the 17 Nov baseline. The most likely explanation is that the live
statement opens with an `fcm_tokens` drop/migration prologue that the file (a later clean
rewrite) omits. The drill proves the file's end state is exactly right: the chain
reproduces the baseline's `push_subscriptions` table, 3 policies, both functions, index
and endpoint CHECK precisely. The live prologue text is unconfirmed — retrieve it with
query Q1 (§8) before treating this as fully closed.

### 5.4 `add_patient_custom_tags` — PROD RESOLVED, STAGING OPEN

Three different texts: file 680 chars, Production live 479, Staging live 326.
Production's end state is verified from the baseline: `patients.tags jsonb NOT NULL
DEFAULT '[]'::jsonb` and constraint `patients_tags_valid` (array, ≤ 20) are both present —
exactly the file's end state. The length gap is most plausibly the file's `COMMENT ON
COLUMN` (~150 chars) plus formatting. Staging's much shorter 326-char statement may lack
the constraint, the comment, or both — **unverified**. Needs live query Q2 (§8) before the
staging end state can be asserted.

### 5.5 `revoke_excess_public_table_privileges` — END STATE VERIFIED; FILE DOES NOT APPLY AS-WRITTEN TO STAGING

Three different texts: PR #75 candidate file 2,814 chars, Production live 1,806, Staging
live 2,260. The least-privilege end state is verified live on both projects (follow-up §1:
no excess `MAINTAIN`/`REFERENCES`/`TRIGGER` grants; public config SELECT and authenticated
DML preserved). The drill found *why* the texts differ:

- The file's assertions assume Production's grant state. On a pure Staging file chain the
  file **fails**: `The explicitly public platform_config SELECT grant was lost` — because
  no Staging file grants `anon SELECT` on `platform_config` (only the Production alignment
  file does, line 1187). Live Staging evidently had the grant from manual provisioning and
  its stored statement (2,260 chars) was adapted accordingly.
- The Production live statement (1,806 chars) is far shorter than the file, suggesting the
  applied version trimmed comments and/or assertions.

The file lives only on PR #75's branch — it is not on main. End state is correct on both
projects; the exact applied texts need query Q1 (§8). Recommendation for PROMPT 6: record
the Staging grant gap as a documentation defect (a future Staging rebuild from files alone
would fail this migration's assertion without the manual grant).

### 5.6 `allow_chromium_web_push_endpoints` — STAGING-ONLY, NOT A PHASE 1 GATE

File (PR #76, 2,492 chars) vs Staging live (2,350 chars). The drill confirms the file's
effect: the endpoint CHECK admits `fcm.googleapis.com` and `claim_push_subscription`
becomes SECURITY INVOKER with `ON CONFLICT DO NOTHING`. Production does not have this
change (baseline CHECK is Mozilla/Apple/Windows only; `claim_push_subscription` is the
harden version). Per the follow-up §4, its Production rollout is a separate notification
release, not a Phase 1 gate.

## 6. Restore drill (21 November 2026)

### 6.1 Method and the Docker blocker

Docker was attempted first, as briefed. The daemon starts with
`dockerd --iptables=false --bridge=none --storage-driver=vfs` (default start fails on
iptables; overlayfs extraction fails on mounts) and `postgres:17` pulls successfully —
but containers cannot start: `runc create failed: ... join container mntns: setns:
operation not permitted`. The sandbox blocks the namespace operations runc needs, so the
Docker path is definitively closed in this VM.

Fallback: **PGlite 0.5.16** (`@electric-sql/pglite`, the repo's own validator engine) —
real PostgreSQL 17 in-process. The drill harness (`/tmp/drill/`, not committed) runs four
instances: from-empty bootstrap, baseline, Production chain, Staging chain, with the
validator's preamble stubs (roles `anon`/`authenticated`/`service_role`, `auth.users`,
`vault.decrypted_secrets`, `auth.uid()`/`auth.jwt()`).

### 6.2 Seed (what the chains need but Git cannot provide)

Each chain ran over a seed reconstructed from the baseline snapshot (§4): the 10 (prod) /
7 (staging) pre-existing tables with their legacy definitions, 3 sequences, the 9 legacy
helper functions (bodies from the baseline — the only record), 7 legacy policies as
permissive stubs (predicates unrecoverable; all are dropped by the chains, so the end
state is unaffected), legacy indexes `idx_consents_patient`/`idx_day_logs_patient` plus
the three to-be-dropped duplicates (definitions assumed — the drop is by name only), and
for Staging only, the manual-provisioning grant `anon SELECT` on `platform_config`
(§5.5). `patients.tags` and its constraint were deliberately excluded from the seed so
the Nov-14 migration does real work. For Staging, `day_logs.id` was seeded as
`GENERATED ALWAYS AS IDENTITY` (per the audit) and the `_key` unique constraint omitted.

Seed assumptions are documented in the harness and each is either end-state-neutral
(policy predicates, index definitions) or flagged as an open verification (§8: staging's
`private.can_access_patient` body, `idx_consents_patient` on Staging).

### 6.3 Results

**From-empty bootstrap (no seed):** both chains fail at the first file, as predicted —
Production: `relation "public.profiles" does not exist`; Staging: `relation
"public.patients" does not exist`. (The second Production file passes from empty only
because it is all `DROP POLICY IF EXISTS` no-ops.) The migration files alone cannot
bootstrap either environment.

**Production chain (16 files over the legacy seed): all 16 apply cleanly.** Result:
11 tables, 40 policies, 23 indexes, 19 routines, 2 triggers, 87 constraints — exactly the
baseline counts, with zero diffs in tables, columns, policies, functions, indexes,
triggers, sequences and function ACLs.

**Staging chain (28 files over the manual seed + 4 branch files): all 28 apply cleanly**
(after seeding the manual `anon` grant, §5.5). All 15 staging checks pass: 12 tables,
43 policies, 20 routines, 3 triggers, `consents.updated_at` present,
`adherence_scores.note NOT NULL DEFAULT ''`, `day_logs.id` identity,
`consents_patient_purpose_key` present, `day_logs_patient_id_log_date_key` absent,
`day_logs_patient_id_log_date_uidx` present, fcm endpoint allowed, appointments table +
3 policies + `validate_appointment_booking` + trigger present, duplicate indexes dropped.

**Drill-run history (method note):** run 1 failed at the alignment file
(`function public.caller_role() does not exist`) — the file `REVOKE`s EXECUTE on the four
public legacy helpers at lines 1195–1198 with no `IF EXISTS`, and the staging
reconciliation file's policies call the four private helpers without defining them. That
failure is itself evidence for §4: both chains assume pre-existing helper functions. The
seed was extended with the 9 legacy functions (from the baseline) and the drill re-run;
run 2 then exposed the Staging revoke assertion (§5.5), fixed by seeding the manual
`anon` grant; run 3 is the clean result above.

### 6.4 Remaining diffs (Production chain vs baseline)

1. **One constraint, cosmetic:** `push_subscriptions_endpoint_https` deparses with
   different parenthesis grouping (file's `BETWEEN … AND …` vs baseline's expanded form).
   Same predicate, same regex. No action.
2. **`service_role` ACL letters on all 11 tables:** the baseline grants `service_role`
   `arwdxt` (incl. REFERENCES, TRIGGER); the chain produces `arwd`. These are
   Supabase-managed defaults on the live project, not a migration-file effect — no file
   grants REFERENCES/TRIGGER to `service_role`, and the revoke file deliberately touches
   only `anon`/`authenticated`. Benign (service_role is the admin key). Same cause for
   the one `defaultAcls` diff (`service_role=arwdxtm` on live defaults vs `arwd`).
3. **`service_role` MAINTAIN on `push_subscriptions`:** present in the drill (`GRANT ALL`
   in the file), absent in the live baseline. Likely the live `replace_legacy_push_tokens`
   statement grants an explicit list instead of `ALL` (consistent with §5.3); unconfirmed
   pending Q1. No security impact.

### 6.5 Production vs Staging schema differences (drill-confirmed)

Beyond the audit §6A list (consents.updated_at, adherence note, day_logs.id,
unique-index names, appointments), the drill surfaced three more:

- **Foreign keys present on Staging, absent on Production:**
  `adherence_configs.updated_by → profiles`, `adherence_scores.entered_by → profiles`,
  `consents.granted_by → profiles`. The Nov-9 reconciliation file creates these tables
  with inline `REFERENCES`; on Production the tables pre-existed, so `CREATE TABLE IF NOT
  EXISTS` skipped them. Low impact (audit-column integrity only), but a real divergence.
- **CHECK naming:** the adherence overall-range CHECK is `adherence_scores_overall_range`
  on Production (legacy name) vs auto-named `adherence_scores_overall_check` on Staging.
  Same predicate.
- **`idx_consents_patient`:** present on Production (legacy); presence on Staging is
  unverified (no file creates it) — see Q3.

Staging-vs-Production inventory: tables +1 (appointments), columns +15/−2, policies +3
(appointments), functions +2/−1 (`validate_appointment_booking`, chromium `claim` vs
harden `claim`), indexes +7/−3, constraints +29/−4 — every item explained by appointments,
the §6A column/index differences, the FK/checkpoint notes above, or the chromium change.

## 7. Trusted baseline record — ordered chains

These are the exact ordered file sets that reproduce each environment in the drill,
**given the §6.2 seed**. They are not bootstrap chains: without the seed they fail at
file 1 (§6.3).

**Production (16 files):**

```
20261109115448_production_legacy_alignment.sql
20261109115743_drop_legacy_public_data_policies.sql
20261113020248_atomic_clinic_payment_requests.sql
20261113020409_consolidate_clinic_subscription_update_policy.sql
20261113021000_harden_payment_request_idempotency.sql
20261113021200_fix_payment_request_jsonb_keys.sql
20261113024000_remove_duplicate_production_indexes.sql
20261113025000_secure_patient_subscription_gate.sql
20261113025500_fail_closed_disabled_and_suspended_access.sql
20261113025700_restrict_disabled_patient_auxiliary_access.sql
20261113025800_restrict_clinic_record_updates_to_owner.sql
20261113025900_revoke_public_helper_execute.sql
20261114045406_add_patient_custom_tags.sql
20261117140700_replace_legacy_push_tokens.sql
20261117150000_harden_push_subscription_registration.sql
20261117170000_revoke_excess_public_table_privileges.sql   (PR #75 branch only)
```

**Staging (28 files):**

```
20261109061815_staging_schema_reconciliation.sql
20261109062015_performance_policy_tuning.sql
20261109063122_owner_atomic_operations.sql
20261109063451_owner_rpc_argument_validation.sql
20261109063920_owner_rpc_security_invoker.sql
20261109072358_profiles_admin_only_visibility.sql
20261109072730_explicit_rls_all_platform_tables.sql
20261109073443_consolidate_clinic_subscription_policies.sql
20261109073735_restrict_remaining_public_policies.sql
20261109074419_consolidate_remaining_rls_policies.sql
20261109074506_split_platform_config_read.sql
20261113020248_atomic_clinic_payment_requests.sql
20261113020409_consolidate_clinic_subscription_update_policy.sql
20261113021000_harden_payment_request_idempotency.sql
20261113021200_fix_payment_request_jsonb_keys.sql
20261113024000_remove_duplicate_production_indexes.sql
20261113025000_secure_patient_subscription_gate.sql
20261113025500_fail_closed_disabled_and_suspended_access.sql
20261113025700_restrict_disabled_patient_auxiliary_access.sql
20261113025800_restrict_clinic_record_updates_to_owner.sql
20261113025900_revoke_public_helper_execute.sql
20261114045406_add_patient_custom_tags.sql
20261114064838_clinic_appointments.sql                  (PR #71 only)
20261114064903_appointments_created_by_idx.sql          (PR #71 only)
20261117140700_replace_legacy_push_tokens.sql
20261117150000_harden_push_subscription_registration.sql
20261117170000_revoke_excess_public_table_privileges.sql   (PR #75 branch only)
20261118060141_allow_chromium_web_push_endpoints.sql       (PR #76 only)
```

**Not in either chain:** `20261031000000_baseline.sql` (placeholder, no DDL),
`20261101000000_p0_security_fixes.sql` (superseded, §3). The canonical Production schema
source remains `supabase/baselines/production-schema.sql` (validator PASS, re-run 21 Nov).

## 8. Open items needing live SQL (read-only, Dashboard SQL Editor)

All queries below are `SELECT`-only. Run each against the project named; never against
Production with a write.

**Q1 — Full stored statements (both projects).** Closes §5.3, §5.5, §5.6 and the
un-compared files (§3) definitively.

```sql
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

**Q2 — Staging `patients.tags` end state (§5.4).**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'tags';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.patients'::regclass AND conname = 'patients_tags_valid';
```

**Q3 — Staging `idx_consents_patient` (§6.5).**

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'consents';
```

**Q4 — Staging `private.can_access_patient` body** (drill assumes it equals Production's;
no file defines it on Staging).

```sql
SELECT pg_get_functiondef('private.can_access_patient(uuid)'::regprocedure);
```

**Q5 — Staging `anon` SELECT on `platform_config`** (assumed present from manual
provisioning; the drill seeds it, §5.5).

```sql
SELECT has_table_privilege('anon', 'public.platform_config', 'SELECT');
```

**Q6 — Confirm `fcm_tokens` is gone from both projects (§4).**

```sql
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'fcm_tokens';
-- expect 0 rows on both projects
```

**Q7 — Staging ledger version for the chromium change (§2.2, record 28).**

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name = 'allow_chromium_web_push_endpoints';
```

## 9. Notes for PROMPT 6 (closure report)

- The migration source-to-live mapping is now **documented end-to-end**: every ledger
  record maps to a Git file (or a named branch file), every file has a verdict, and both
  chains are proven to converge in a clean room given the documented seed.
- What is **not** closed by this document: byte-exactness of 13 files never compared
  (11 Nov-9 + 2 alignment — version/name only); the live statement texts for the 6 drift
  cases (Q1); Staging's `patients.tags` end state (Q2); the disposable-Supabase-project
  restore test (Auth/Vault/Realtime prerequisites untested — the PGlite drill stubs them).
- Do not "repair" the drift by editing historical files or inserting ledger rows. The
  three end-state-identical diffs (§5.1–§5.3) are history, not defects. The one genuine
  file-chain defect is §5.5: the revoke file's assertions fail on a pure Staging file
  chain for want of the manual `anon` grant — record it as a documentation gap, and
  consider a Staging baseline snapshot (none exists) as follow-up work.
- The drill harness lives in `/tmp/drill/` (seed extractor + PGlite runner + results)
  and was deliberately not committed; if PROMPT 6 wants it preserved, it should be
  reviewed and added under `scripts/` as a follow-up change, not smuggled into this
  documentation PR.
