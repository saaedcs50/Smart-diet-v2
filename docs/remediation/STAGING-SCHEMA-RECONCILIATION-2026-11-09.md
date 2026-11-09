# Smart Diet v2 — Staging schema reconciliation

**Date:** 2026-11-09  
**Environment:** Supabase `smart-diet-v2-staging` (`dubevgijagqjgwcibqeo`) only  
**Branch:** `codex/p0-staging-schema-reconcile-2026-11-09`

## Scope and safety boundary

This change was applied to the active Staging project only. No production Supabase project, Vercel production environment variable, production deployment, or user health record was changed. The invitation regression tests used synthetic UUIDs and `example.test` email addresses inside a transaction that was rolled back.

These migrations reconcile the existing manually provisioned Staging schema. They do **not** make the repository a reproducible bootstrap for a brand-new Supabase project. The old `20261031000000_baseline.sql` remains an inventory-only/comment file, and the older P0 migration still needs to be reconciled to the actual `private.*` helper function names. A canonical full baseline/bootstrap migration is still required before claiming a clean-room restore.

## Changes applied

### `20261109061815_staging_schema_reconciliation.sql`

- Added the four missing application tables: `adherence_configs`, `adherence_scores`, `fcm_tokens`, and `consents`, with RLS enabled and patient/profile foreign keys.
- Added the unique `day_logs(patient_id, log_date)` index required by the application's upsert conflict target, plus the verified-safe patient foreign key.
- Added access policies: patients can read their permitted adherence data; clinic staff can write adherence data only within patient access scope; patients manage their own push tokens and sync consents.
- Reworked invitation policies so a self-created profile must match a pending invitation's normalized email, exact role, and clinic. The invitee can consume a pending invitation, but cannot reopen it. A clinic admin/owner can re-open invitations in scope; a coach can manage only patient invitations they created.
- Hardened the invitation trigger so email, role, clinic, and creator cannot be mutated, and status transitions are actor-specific.
- Corrected table/sequence grants for `authenticated` and `service_role`, revoked `TRUNCATE` from API roles, removed `anon` access to the private schema, and granted authenticated-only execution on the private helper functions.
- Added `profiles` to the `supabase_realtime` publication for the authentication profile listener.

### `20261109062015_performance_policy_tuning.sql`

- Added indexes for the new non-leading foreign keys.
- Converted remaining direct `auth.uid()` / `auth.jwt()` calls in the identified patient/profile/invitation policies to scalar subqueries for statement-level initialization.

## Verification performed on Staging

- 11 public tables exist; all 11 have RLS enabled.
- Both migrations are recorded in the Supabase migration history.
- `day_logs_patient_id_log_date_uidx` exists.
- `profiles` is in the Realtime publication.
- Effective grants were checked with `has_table_privilege`: `authenticated` and `service_role` have SELECT/INSERT/UPDATE/DELETE across the public tables and no TRUNCATE; `anon` has no CRUD and no TRUNCATE. `anon` has no `private` schema usage; `authenticated` does.
- Referential integrity aggregate checks returned zero orphans for the existing profile/patient/clinic/invitation/subscription/day-log relationships before applying changes.
- A synthetic transaction under `SET LOCAL ROLE authenticated` verified invitation-based admin profile creation, invitee consumption, and clinic-admin re-opening. The transaction was rolled back; the synthetic test data was not retained.
- Supabase Security Advisor now reports only the existing warning that leaked-password protection is disabled.
- Supabase Health Advisor returned no findings.
- The Auth RLS init-plan warnings were cleared. Remaining Performance Advisor findings are multiple permissive policies on legacy tables and unused indexes in the newly-created/low-traffic schema. The unused-index notices are not grounds for dropping indexes before workload testing.

## Remaining blockers (not addressed by this migration)

1. **Production Supabase is INACTIVE.** Vercel production still points to that project. It must be recovered/replaced and validated before opening the platform gate or changing production environment variables.
2. **Platform gate / owner profile:** `VITE_PLATFORM_ENABLED` is blank in Vercel. Staging has one `owner` profile, but it does not use the documented `clinic_id='platform'`; its identity/ownership mapping was not changed. Confirm the intended owner account before changing this record.
3. **Push delivery:** no `notify` Edge Function is deployed to Staging. The checked-in implementation still sends an unencrypted Web Push payload (RFC 8291 is not implemented), so it must not be deployed for data-bearing notifications until encryption and protocol tests pass.
4. **RLS test coverage:** the invitation smoke test passed, but a complete role × table × command isolation matrix is still required in an isolated test project/CI. Existing multiple-permissive-policy warnings still need a per-table review.
5. **Fresh-project bootstrap:** replace the comment-only baseline and reconcile historical migration drift before attempting a clean-room database build.
6. **Owner operations:** clinic provisioning is not atomic and payment JSON read-modify-write can lose concurrent updates; use tested RPCs/transactions or a normalized payment table.
7. **Application/privacy work:** local storage is not yet isolated by signed-in user; implement account-switch/logout isolation before enabling broad cloud rollout.
8. **Phase 7 export:** CSV, Excel, and PDF exports for the doctor's patients are not yet implemented.
9. **Auth settings:** leaked-password protection is still disabled; enable after assessing the expected effect on current sign-ins/password changes.
10. **Production rollout:** do not change production Vercel variables, reactivate the inactive database, or publish until the above blockers are cleared and staging E2E passes.

## Release decision

**Staging schema reconciliation: applied and verified. Production readiness: NOT APPROVED.**