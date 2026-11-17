# Phase 1 — Supabase Data Independence Audit

**Audit date:** 17 November 2026  
**Repository:** `saaedcs50/Smart-diet-v2`  
**Audited branch / commit:** `main` / `8d48f7d782236e78b011a9033f84a89578c70a9c`  
**Production:** `smart-diet-platform` (`lhjyshlxbsnesayivxpb`)  
**Staging:** `smart-diet-v2-staging` (`dubevgijagqjgwcibqeo`)  
**Related PRs:** [Phase 0 #74](https://github.com/saaedcs50/Smart-diet-v2/pull/74), [Appointments #71](https://github.com/saaedcs50/Smart-diet-v2/pull/71)

## Executive result

The Supabase client and database authorization model are not tied to Vercel. Both live projects are healthy, every inspected application table has RLS enabled, the database role helpers fail closed for disabled users, and the Staging role matrix passed.

No Production schema, account, data, secret, or project setting was changed. Both SQL test suites were run against Staging inside transactions and rolled back; post-test queries confirmed that their fixture writes were absent.

**Phase 1 is not marked closed.** The deployed migration ledgers do not map cleanly to migration source filenames in Git; Supabase Auth redirect settings and Google OAuth callbacks could not be verified against a new non-Vercel test origin; and a direct Realtime WebSocket isolation test remains outstanding. These are explicit closure gates, not assumed successes.

## 1. Supabase client and authentication

### Client configuration

- `src/platform/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `getSupabase()` caches the client rather than constructing one for every call.
- The inspected client module does not derive the project URL from the frontend hostname, a Vercel URL, or an API base URL.
- Project selection is controlled by build-time environment values, not by the frontend host. A new host must receive the same intended project URL and public anon key; it must never receive a service-role secret.

### Identity and role resolution

- `src/platform/auth.tsx` restores the persisted session with `auth.getSession()` and listens for Auth changes.
- The platform profile is fetched from `public.profiles` using the authenticated UID.
- Accepted application roles are `owner`, `admin`, `coach`, and `patient`. The application role is parsed from the database profile rather than trusted from a browser-supplied role claim.
- Google OAuth redirects to `window.location.origin + '/platform'`, not a hard-coded Vercel hostname.
- Live database helpers `private.caller_role()` and `private.caller_clinic_id()` both require `profiles.disabled IS NOT TRUE`. `private.can_access_patient()` applies owner/admin/assigned-coach/patient scope and the active-clinic subscription gate.
- The Staging tests verified that a disabled coach and a suspended clinic lose operational access.

### Auth configuration still to verify

The connected project-management operations exposed database and project inspection, but not the Auth redirect URL allow-list or the Google OAuth provider callback configuration. The Phase 0 baseline records `https://smart-diet-v2.vercel.app/` as the Production frontend and records that the latest inspected Vercel Preview returned HTTP 500 for `/api/health`; it did not record a stable Preview hostname. Preview was therefore not treated as a healthy Auth test surface, and no non-Vercel test hostname was selected or deployed during this phase. No redirect entry was added or removed. Preserve the Production origin when the actual test hostname is selected. Sign-in, sign-out, session restoration, and Google OAuth must be exercised from that origin before this item can close.

The Supabase Security Advisor reports **Leaked Password Protection is disabled** in both projects. This is an Auth security-setting warning, not an RLS failure. It was not changed because Auth settings were not exposed by the available project-management interface; enable and verify it in Supabase Auth settings.

## 2. Live schema inventory

The following counts were queried from live PostgreSQL catalogs on 17 November 2026.

| Catalog item | Production | Staging |
|---|---:|---:|
| Application tables in `public` | 11 | 12 |
| Tables with RLS enabled | 11 | 12 |
| Policies on `public` tables | 40 | 43 |
| Indexes in `public` | 23 | 26 |
| Constraints on `public` tables | 33 | 36 |
| `SECURITY DEFINER` functions in `public` / `private` | 13 | 11 |
| Such functions missing `search_path = ''` | 0 | 0 |
| Such functions executable by `anon` | 0 | 0 |
| Storage buckets / Storage policies | 0 / 0 | 0 / 0 |
| Tables in `supabase_realtime` publication | `public.profiles` | `public.profiles` |

The 11 Production tables are: `profiles`, `clinics`, `clinic_subscriptions`, `invitations`, `patients`, `day_logs`, `adherence_configs`, `adherence_scores`, `consents`, `platform_config`, and `push_subscriptions`.

Staging has those same 11 tables plus `appointments`. Production has no `appointments` table. The Staging appointment schema is associated with open PR #71 and is not present on `main`.

The `profiles` table currently has one `owner` profile in Production and six synthetic test profiles in Staging (one owner, one admin, one coach, and three patients). Neither project currently has a profile with `disabled = true`. These are profile-row counts, not counts of all Supabase Auth identities.

### RLS policy shape

Production has four policies each on `profiles`, `clinics`, `clinic_subscriptions`, `invitations`, `patients`, `adherence_configs`, and `adherence_scores`; five on `platform_config`; three on `consents`; three on `push_subscriptions`; and one on `day_logs`.

Staging has those same policy counts plus three policies on `appointments`.

The policies and helper functions enforce the current clinic model: an admin is scoped to their clinic; a coach is scoped to patients assigned/invited by that coach; a patient is scoped to their own patient data; and the platform owner has only the explicitly defined owner paths. Clinic subscription and suspended-clinic checks are applied in the database layer. Anonymous access is limited to the explicitly public platform-configuration path; the live role matrix confirmed that anonymous access did not expose patient, clinic, or subscription data.

### SECURITY DEFINER review

Live catalog inspection found no `SECURITY DEFINER` function in the inspected `public` or `private` schemas with a missing/non-empty search path, and none was executable by `anon`. Helper functions intentionally granted to `authenticated` support RLS or narrow application RPC paths. Legacy public helper duplicates have no client execution grant.

This is a catalog-level review. It does not replace a source-to-live SQL body comparison, which remains part of migration reconciliation.

## 3. Live Staging RLS tests

### Core role matrix

Executed repository file `supabase/tests/rls_role_matrix_staging.sql` (blob SHA `2480b5ea4d0b7d7735f30cb0d910f9c560a59e9a`) against Staging only.

**Result: `rls_role_matrix_staging: PASS`.**

Coverage includes owner visibility and owner-only changes; admin clinic scope; coach scope limited to assigned patients; patient access limited to their own data; cross-clinic rejection; invitation consumption and reopening rules; push endpoint anti-takeover; disabled-coach and suspended-clinic fail-closed behavior; and anonymous access limited to public platform configuration.

### Appointments role matrix

Executed `supabase/tests/appointments_rls_staging.sql` from the still-open PR #71 branch (blob SHA `bc2f7c2c9ce4d15bff3f8d1f44ed8cb11afa41a3`) against Staging only.

**Result: `appointments_rls_staging: PASS`.**

Coverage includes clinic-admin booking, doctor scope, patient read-only scope, cross-clinic rejection, platform-owner isolation, and conflicting provider/patient bookings. After rollback, `public.appointments` still contained zero rows.

The base role-matrix rollback check also confirmed that its temporary invitation, push endpoint, day log, adherence rows, disabled flag, and clinic suspension did not remain.

### Production test boundary

No synthetic fixtures were inserted into Production. The role matrix was executed on the synthetic Staging project. Production was checked read-only for table RLS, policies, function security, grants, and publication membership.

## 4. Storage and Realtime

### Storage is intentionally not a cloud feature in this application

There are no Supabase Storage buckets or Storage policies in either live project. The application source explicitly documents that cloud photo storage was disabled by the owner. Progress photos are stored in browser IndexedDB, with local storage scopes separated by account UID; the photo migration helper copies between local IndexedDB scopes and does not upload files.

The absence of Supabase Storage buckets is **intentional and consistent with the current code**, not a missing bucket to create during hosting separation. Do not create public buckets or convert patient photos into public URLs as part of this work.

### Realtime

Both projects publish only `public.profiles` to `supabase_realtime`. The Auth provider subscribes to a per-user channel named `profile-<uid>` and applies the row filter `id=eq.<uid>`. The live RLS role matrix confirms that each role can select only its authorized profile rows.

No direct authenticated WebSocket test was performed. Publication membership, the client filter, and database RLS were inspected; a final browser-level subscription test across two authenticated Staging clinics remains open.

## 5. Migration ledger reconciliation

The live migration histories are not identical to the repository's source filenames, and Production and Staging do not share one common version sequence.

### Production — 15 recorded migrations

| Version | Name |
|---|---|
| 20261109115448 | production_legacy_alignment |
| 20261109115743 | drop_legacy_public_data_policies |
| 20261113023307 | atomic_clinic_payment_requests |
| 20261113023310 | consolidate_clinic_subscription_update_policy |
| 20261113023312 | harden_payment_request_idempotency |
| 20261113023315 | fix_payment_request_jsonb_keys |
| 20261113023422 | remove_duplicate_production_indexes |
| 20261113023618 | secure_patient_subscription_gate |
| 20261113023848 | fail_closed_disabled_and_suspended_access |
| 20261113023914 | restrict_disabled_patient_auxiliary_access |
| 20261113023953 | restrict_clinic_record_updates_to_owner |
| 20261113024146 | revoke_public_helper_execute |
| 20261114045803 | add_patient_custom_tags |
| 20261117153100 | replace_legacy_push_tokens |
| 20261117153103 | harden_push_subscription_registration |

### Staging — 26 recorded migrations

| Version | Name |
|---|---|
| 20261109061815 | staging_schema_reconciliation |
| 20261109062015 | performance_policy_tuning |
| 20261109063122 | owner_atomic_operations |
| 20261109063451 | owner_rpc_argument_validation |
| 20261109063920 | owner_rpc_security_invoker |
| 20261109072358 | profiles_admin_only_visibility |
| 20261109072730 | explicit_rls_all_platform_tables |
| 20261109073443 | consolidate_clinic_subscription_policies |
| 20261109073735 | restrict_remaining_public_policies |
| 20261109074419 | consolidate_remaining_rls_policies |
| 20261109074506 | split_platform_config_read |
| 20261113020248 | atomic_clinic_payment_requests |
| 20261113020409 | consolidate_clinic_subscription_update_policy |
| 20261113022823 | harden_payment_request_idempotency |
| 20261113022850 | fix_payment_request_jsonb_keys |
| 20261113023420 | remove_duplicate_production_indexes |
| 20261113023617 | secure_patient_subscription_gate |
| 20261113023846 | fail_closed_disabled_and_suspended_access |
| 20261113023913 | restrict_disabled_patient_auxiliary_access |
| 20261113023952 | restrict_clinic_record_updates_to_owner |
| 20261113024145 | revoke_public_helper_execute |
| 20261114045406 | add_patient_custom_tags |
| 20261114064838 | clinic_appointments |
| 20261114064903 | appointments_created_by_idx |
| 20261117144922 | replace_legacy_push_tokens |
| 20261117145227 | harden_push_subscription_registration |

### Source-to-live drift

- Repository source files use version prefixes such as `20261113020248`, `20261113021000`, and `20261113025000`; Production records similarly named changes under different IDs such as `20261113023307`, `20261113023312`, and `20261113023618`.
- Several Staging records also differ from similarly named Git source files. For push registration, repository filenames are `20261117140700` and `20261117150000`, while Staging records `20261117144922` and `20261117145227`; Production records `20261117153100` and `20261117153103`.
- Staging has 11 November 9 reconciliation/security migrations absent from the Production ledger. Production instead records two Production legacy-alignment migrations.
- Staging has the two appointments migrations, but their files currently exist only on open PR #71, not on `main`; Production has neither the appointments table nor those migration records.
- The repository contains a baseline source file, but neither live ledger reports that filename/version as an applied migration. Do not infer that the baseline is safe to replay.
- `scripts/check-supabase-rls.mjs` is a static repository check. It does not query either live migration ledger and cannot prove that a live database applied the exact SQL bytes present in Git.
- The migration history returned version/name records, not SQL checksums. This audit therefore does not claim byte-for-byte identity between a Git SQL file and SQL previously executed in either environment.

### Safe migration decision

No migration or baseline was applied. No Production backup was taken because no Production DDL was attempted. Before approving a canonical rebuild baseline, export the complete live schema (tables, types, sequences, indexes, constraints, functions, triggers, policies, grants, extensions, and relevant settings) from each project, compare it with Git, and document per-project version-to-source mapping. Test the resulting baseline by rebuilding a clean disposable database. Do not solve ledger drift by renaming old files or inserting fabricated rows into Supabase migration history.

## 6. Findings and remaining closure gates

| Item | Result | Evidence still needed |
|---|---|---|
| Supabase client independence from Vercel | PASS | Supply the same intended Supabase environment values to the new frontend host |
| Role source and database-side disabled-user enforcement | PASS in code/catalog; Staging test PASS | None for database enforcement |
| Core multi-clinic RLS | PASS on Staging | Do not seed synthetic test users into Production |
| Appointment RLS | PASS on Staging | PR #71 remains open; Production intentionally has no appointments schema |
| Storage | PASS for current design; cloud Storage intentionally unused | No bucket creation required |
| Realtime profile isolation | Catalog/client/RLS review PASS | Direct two-clinic authenticated WebSocket test |
| Migration ledger and canonical baseline | **OPEN** | Full schema export, exact source mapping, clean rebuild test |
| Auth redirect and Google OAuth on another host | **OPEN** | Select/deploy test origin, verify Auth allow-list and Google callback, test sign-in/sign-out/session restore |
| Leaked Password Protection | **WARNING** | Enable and verify in Supabase Auth settings |

## 7. Change and safety record

- Audited the source commit shown above. PR #74 remained open and unmerged at audit time.
- PR #71 remained open and unmerged; its appointments schema is present in Staging only.
- No application data was copied, transformed, deleted, or migrated.
- No Supabase project was created, paused, restored, reconfigured, or replaced.
- No Production SQL write, schema DDL, Auth setting change, or secret change was performed.
- The only database writes attempted were synthetic Staging fixture operations inside rollback-only test transactions. Both tests passed, and post-test checks confirmed that no fixture rows or state changes remained.

**Phase 1 disposition: live Staging authorization tests and the independence audit are complete; migration baseline and cross-host Auth/Realtime verification remain open. Do not apply Production migrations or mark Phase 1 fully closed until those gates are satisfied.**
