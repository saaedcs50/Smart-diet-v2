# Phase 1 — Supabase Data Independence: Closure Follow-up

**Verification date:** 21 November 2026  
**Repository:** `saaedcs50/Smart-diet-v2`  
**Target branch:** `main`  
**Production:** `smart-diet-platform` (`lhjyshlxbsnesayivxpb`)  
**Staging:** `smart-diet-v2-staging` (`dubevgijagqjgwcibqeo`)  
**Related audit:** [PR #75](https://github.com/saaedcs50/Smart-diet-v2/pull/75)  
**Disposition:** **NOT CLOSED — core database controls pass; explicit authentication, Realtime and migration-reconciliation gates remain open.**

This follow-up records live verification against the Phase 1 checklist in `SMART-DIET-VERCEL-INDEPENDENCE-IMPLEMENTATION-PLAN.md`. It does not replace the full audit in PR #75 and does not authorize a production schema rebuild.

## 1. Current verification

| Phase 1 area | Current result | Evidence / boundary |
|---|---|---|
| Supabase client independence | PASS in source | `src/platform/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, caches one client, and does not derive the project from Vercel or the frontend hostname. |
| Auth identity and roles | PASS in code / database model | The app restores the Supabase session, fetches `profiles` by authenticated UID and parses only `owner`, `admin`, `coach`, `patient`. Database authorization helpers check disabled status and scope. |
| Live project health | PASS | Production and Staging both report `ACTIVE_HEALTHY` on PostgreSQL 17. |
| RLS coverage | PASS | Production: 11/11 public application tables have RLS. Staging: 12/12, including Staging-only `appointments`. Production has 40 public policies; Staging has 43. |
| RLS role matrix | PASS — re-run 21 Nov | `supabase/tests/rls_role_matrix_staging.sql` ran against Staging in one transaction and completed without an exception. A post-run query confirmed the temporary invitation, consent and Push fixtures were absent, `clinic-a` was `active`, and the pre-existing six profiles, two patients and one day-log row remained unchanged. The script ends in `ROLLBACK`; Production was not used for synthetic fixtures. |
| Function hardening | PASS in live catalogs | Inspected public/private functions in both projects: all inspected `SECURITY DEFINER` functions have `search_path = ''`; none grants EXECUTE to `anon`. Push registration is `SECURITY INVOKER`. |
| Least-privilege table grants | PASS — already applied | Production ledger records `20261117165914`; Staging records `20261117174650`. Live catalog checks show no excess `MAINTAIN`, `REFERENCES` or `TRIGGER` grants to `anon`/`authenticated`; intended public config SELECT and authenticated application DML remain. |
| Storage | PASS for current product design | Both projects have zero Storage buckets and zero Storage policies. This is intentional: progress photos are local in IndexedDB; do not create public buckets or migrate patient photos as part of Phase 1. |
| Realtime publication | PARTIAL | Both projects publish only `public.profiles`. The client subscribes to a UID-filtered profile channel. Database RLS was tested, but authenticated WebSocket delivery/isolation has not yet been demonstrated in a browser. |
| Production schema baseline | IMPLEMENTED on PR #75 branch; clean-room validation reported PASS | The schema-only baseline and PGlite replay test cover 11 tables, 40 policies, 23 indexes, 19 routines, 2 triggers, 11 RLS-enabled tables and 33 constraints. Supabase-managed Auth/Vault catalog objects are stubbed and Realtime publication DDL is skipped. This is not a full restore into a fresh Supabase project and is not a runnable migration chain for an existing database. |
| Auth redirect / Google OAuth on alternate origin | PARTIAL / OPEN | The 17 Nov audit recorded the Production redirect allow-list as Vercel-only and Google OAuth disabled in both projects. In this follow-up PR #77, both Google sign-in and staff-invitation buttons are now hidden unless `VITE_GOOGLE_OAUTH_ENABLED=true`; the Vercel environment inventory contains no such override, so the default remains disabled while email/password sign-in is unchanged. A dedicated Google OAuth client was created without changing the Firebase client, but Supabase provider credentials/configuration and a successful non-Vercel callback have not been verified. Re-check current Auth settings when the test origin is deployed. |
| Security Advisor | WARNING only | Both projects report Leaked Password Protection disabled. The audit records this as unavailable on the current Free plan (Pro or above); no plan change was made. This is not an RLS failure. |

## 2. Migration ledger reconciliation

The live ledgers currently contain **16 Production** and **28 Staging** records. They are not one shared, source-aligned migration sequence.

A comparison of the SQL bodies stored by Supabase shows matching statement MD5 values across the two projects for these 12 shared changes, despite different version IDs in several cases:

- `atomic_clinic_payment_requests`
- `consolidate_clinic_subscription_update_policy`
- `harden_payment_request_idempotency`
- `fix_payment_request_jsonb_keys`
- `remove_duplicate_production_indexes`
- `secure_patient_subscription_gate`
- `fail_closed_disabled_and_suspended_access`
- `restrict_disabled_patient_auxiliary_access`
- `restrict_clinic_record_updates_to_owner`
- `revoke_public_helper_execute`
- `replace_legacy_push_tokens`
- `harden_push_subscription_registration`

The stored statement hashes differ between environments for `add_patient_custom_tags` and `revoke_excess_public_table_privileges`. Staging also contains its earlier reconciliation/security sequence and the Staging-only appointments migrations; Production contains its legacy-alignment bridge.

**This is useful reconciliation evidence, but it is not yet a verified source-to-live mapping.** The stored SQL for every ledger row still needs to be compared to the exact Git migration file, with environment-specific differences documented. Do not rename historical files, fabricate migration-history entries, replay the inventory-only baseline, or run a clean-room baseline against either live project.

## 3. Remaining closure gates

1. **Authenticated Realtime browser test.** The existing QA harness requires two disposable patient accounts in different Staging clinics plus the Staging owner account. Their passwords are not available to this audit. Run the harness with those accounts and verify each patient receives only their own profile update. The harness restores the synthetic display names and signs out after the test. Do not use Production identities.
2. **Alternate-origin Auth test.** Deploy/choose a non-Vercel test origin, add it to the Supabase Auth redirect allow-list without removing the Production Vercel origin, then test email sign-in, sign-out, session restoration and callback behavior. Google OAuth remains disabled until its dedicated client credentials and Supabase callback configuration are installed and verified. Do not reuse the Firebase OAuth client.
3. **Exact migration source mapping.** Compare every Production/Staging `schema_migrations.statements` entry to the candidate Git SQL source. Explain the two known hash differences and the environment-specific histories. Preserve remote ledgers; do not fabricate version rows.
4. **Clean Supabase restore drill.** Validate the baseline in a disposable Supabase project with Auth/Vault prerequisites and Realtime publication, not only in PGlite. The existing audit records that managed backups/PITR are unavailable on the current Free plan. A schema-only export is not a recoverable backup of patient data; no destructive Production DDL is approved by this report.

## 4. Safety and scope

- This follow-up made **no Production database changes**, moved no patient data and created no credentials.
- The only database write test in this follow-up was the Staging role matrix transaction, which rolled back. Post-run checks confirmed temporary fixtures were absent.
- No Storage bucket was created.
- Phase 1 does not require deploying the optional Cloudflare Worker. PR #75 also contains Worker/hosting work; that work must remain separate from the Supabase notification path. Push registration and `notify` stay Supabase-only.
- The separate PR #76 Chrome Push change is Staging-only; its Production rollout is not a Phase 1 data-independence gate and must be handled as its own notification release.

## 5. Closure decision

**Do not mark Phase 1 closed yet.** The core Supabase connection, RLS policy coverage, function hardening, least-privilege grants and rollback-only Staging role matrix are passing. The plan's exit condition still requires a demonstrated alternate-origin Auth flow, a live cross-clinic Realtime WebSocket test, and a documented source-to-live migration reconciliation/restore story.

Once those items are evidenced, update this disposition and close the Phase 1 audit. Until then, retain the current Production Supabase project and do not perform a production baseline replay.
