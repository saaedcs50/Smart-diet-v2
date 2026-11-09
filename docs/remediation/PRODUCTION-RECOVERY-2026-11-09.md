# Production recovery and release status — 2026-11-09

## Recovery completed

- Restored the existing Supabase Production project `smart-diet-platform` (`lhjyshlxbsnesayivxpb`) in place. No project, database branch, or paid add-on was created; the organization remains on its Free plan with its existing two projects.
- Production is now `ACTIVE_HEALTHY` on PostgreSQL 17.11.
- Confirmed Vercel Production's `VITE_SUPABASE_URL` points to the Production project. Preview's Supabase URL/key entries are separately scoped to Staging.
- Reconciled Production with the reviewed Staging schema via migrations `20261109115448_production_legacy_alignment` and `20261109115743_drop_legacy_public_data_policies`.
- The two migration files in `supabase/migrations` now match the versions in Production's migration ledger.
- Production has 11/11 public application tables with RLS enabled, zero policies assigned to broad `PUBLIC`, anon SELECT only on `platform_config`, and zero TRUNCATE grants to `anon`, `authenticated`, or `service_role`.
- Supabase Security and Health advisors returned no findings after cleanup.
- The 31-assertion role matrix passed on Production across `anon`, `owner`, `admin`, `coach`, `patient`, and an invitee. The test used synthetic Auth identities and data inside a single transaction, then rolled it back. A follow-up query verified zero fixture rows remained in Auth, profiles, clinics, subscriptions, patients, logs, adherence, consents, FCM tokens, invitations, and platform config.

## Deployment and environment observations

- The latest Vercel Production deployment for main commit `e061f553fb3a5e32976adf79a7b645b9c60431b4` is `READY`.
- The Production Supabase URL is correctly scoped. No Vercel environment variable or secret was changed during this recovery.
- `VITE_PLATFORM_ENABLED` is empty in Production, so the B2B `/platform` and `/owner` application routes remain disabled. This is intentional until the real platform-owner identity is confirmed and provisioned; Production currently has no Auth users, profiles, clinics, or patient records.
- The Production Coach PIN endpoint remains fail-closed because `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are empty. `VITE_COACH_LOCAL_ONLY=true` does not override this: the app permits local-only PIN setup only in explicit development mode. Do not weaken this guard or use process memory on Vercel.
- The existing Production `notify` Edge Function must not be treated as launch-ready Push delivery. Web Push payload encryption/protocol validation (RFC 8291) is still outstanding, and the application feature remains disabled.

## Outstanding release gates

1. Replace the comment-only baseline with a reproducible clean-room bootstrap. The original seven-table Staging schema was manually provisioned in Dashboard before migration tracking. The repository does not preserve a complete authoritative copy of that exact pre-migration state. The current 11-migration chain expects legacy policy names and objects, so replaying it on top of a snapshot of the final schema is not safe. Do not fabricate a baseline until the historical starting point can be reconstructed and tested.
2. Convert the live role matrix into a reusable isolated CI integration test. The SQL file in this PR records the 31 Production assertions as a repeatable rollback-safe test; it does not replace the existing 33-assertion Staging suite or run automatically in GitHub Actions.
3. Confirm the platform-owner account identity and clinic mapping before enabling `VITE_PLATFORM_ENABLED` or creating an owner profile. Do not copy a Staging user into Production.
4. Resolve the persistent Coach PIN guard without introducing a billable external service or weakening fail-closed behavior.
5. Complete full account-scoped localStorage/IndexedDB isolation, E2E/PWA/offline tests, and a browser-level Production smoke test.
6. Implement and protocol-test Web Push encryption before enabling notifications.
7. Review Auth leaked-password protection and enable it deliberately. Current Supabase Security Advisor has no database findings, but this Auth setting still requires separate review.

## Release decision

**Production database recovery and RLS hardening: complete and verified. Full application launch: not approved yet.** The database is online and its role boundaries pass the Production integration matrix, but the platform-owner identity, app activation, persistent Coach PIN guard, clean-room baseline, account-local-data isolation, E2E/PWA verification, and Push protocol work remain release gates.

No new billable infrastructure, projects, branches, or add-ons were created in this work.
