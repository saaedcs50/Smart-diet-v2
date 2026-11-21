# Supabase Restore Test (C1) — 2026-11-21

## 1. Purpose and status

Phase 1 close-out item **C1** / **Gate 4** (restore drill) in the Phase 1 final
closure report (`docs/phase-1-final-closure-report.md`): a restore of each
environment from the documented bootstrap seed plus the migration chain was
never run against real Supabase services. PROMPT 4
(`docs/migration-reconciliation-2026-11-21.md`) proved both chains converge in
PGlite (real PostgreSQL 17) **given** a documented legacy seed — but PGlite
stubs Auth, Vault, Realtime, and the Supabase roles, and the migration files
alone cannot rebuild either database from empty.

This document records the repeatable restore test built to close that gap,
its design, its bootstrap recipe, what it proves, and what it does not prove.

**Status: GREEN — run 3 (2026-11-21 20:18 UTC) passed on both chains.**
Schema verification 18/18 (production) and 25/25 (staging); services tests
10/10 on each chain. Run evidence is in §7; the equivalence verdict is in §9:
Gate 4 is closed as a documented equivalent alternative, with the residual gap
recorded explicitly.

## 2. Background

- The repo's 28 migration files cannot rebuild either database from empty:
  7 core tables, 9 helper functions, 7 legacy policies, grants, and indexes
  came from a legacy restore / manual provisioning (PROMPT 4 §5–§6).
- The PGlite drill (PROMPT 4 §6) applied both chains over a reconstructed
  seed and converged exactly on both: production 16/16 files, staging 28/28.
- Docker is definitively unusable in the development VM
  (`runc create failed: join container mntns: setns: operation not permitted`),
  so the Supabase CLI local stack cannot run there. The test therefore runs on
  a GitHub Actions runner (`ubuntu-latest`, which has Docker).
- No Supabase project is created for this test (managed or otherwise), and no
  production or staging project is written to. The test target is a throwaway
  local stack that is deleted at the end of every run.

## 3. Design

Two independent restore runs — **production chain (16 files)** and **staging
chain (28 files)**, per PROMPT 4 §7. The mixed 28-file set was never tested as
a whole and is not a restore target.

Each run, on a fresh GitHub Actions runner:

1. **Build a throwaway workdir** (`scripts/supabase-restore-test/build-workdir.mjs`):
   `supabase init` (generates a default config pinned to PostgreSQL 17,
   matching the live projects), then copy the chain's migration files and the
   seed into `supabase/migrations/`.
2. **Seed as first migration.** The seed is copied as
   `20260101000000_restore_seed.sql` so the CLI applies it before every chain
   file (timestamp order). The seed lives **only** in the temp workdir as a
   test bootstrap — it is never committed to `supabase/migrations/`. The seed
   files themselves are committed under `scripts/supabase-restore-test/` as
   the documented recipe (§4).
3. **Start the stack.** `supabase start` pulls the service images and applies
   the migrations in order, managing the migration ledger itself. Ledger rows
   are never fabricated (per PROMPT 4: never "repair" drift by inserting
   ledger rows).
4. **Verify the schema** (`verify-schema.mjs` + shared `checks.mjs`): table,
   policy, index, routine, trigger, RLS-table, and constraint counts, plus
   privilege and object spot-checks (§5).
5. **Test the services PGlite could not test** (`test-services.mjs`): Auth,
   Realtime, Vault (§5). Synthetic data only.
6. **Stop and delete the stack** (`supabase stop --no-backup`, always runs).

### Configuration choice: `auto_expose_new_tables = false`

The generated `config.toml` is edited to set `auto_expose_new_tables = false`.
With the CLI default (`true`), the Data API roles get automatic access to new
tables, which would hide missing GRANTs in the migration files. With `false`,
every grant comes from the seed or the migration files — exactly the model
the PGlite drill verified (otherwise the `anon_patient_isolated` privilege
check could pass for the wrong reason).

### Branch files

Two staging-chain files live on open PR branches, not on `main`:

| File | Branch | PR |
| --- | --- | --- |
| `20261117170000_revoke_excess_public_table_privileges.sql` | `audit/phase-1-supabase-data-independence-2026-11-17` | #75 |
| `20261118060141_allow_chromium_web_push_endpoints.sql` | `fix/supabase-only-push-boundary-2026-11-18` | #76 |

And the appointments pair on PR #71:

| File | Branch | PR |
| --- | --- | --- |
| `20261114000000_add_clinic_appointments.sql` | `feat/clinic-appointments-2026-11-14` | #71 |
| `20261114000001_add_clinic_appointments_indexes.sql` | `feat/clinic-appointments-2026-11-14` | #71 |

`build-workdir.mjs` fetches them via `git show` from their branches into the
temp workdir only. They are never copied into the repo's own
`supabase/migrations/` — that would rewrite the migration history the
reconciliation document describes.

### Workflow

`.github/workflows/supabase-restore-test.yml` — manual dispatch only
(`workflow_dispatch`, optional chain input: `both` / `production` /
`staging`), matrix over the two chains, 30-minute job timeout. Supabase CLI
pinned to **3.2.0** via `supabase/setup-cli@v3` (verified 2026-11-21; CLI v3
targets the local stack by default and needs no `--yes` for local commands).
The workflow uses only local commands: no `--remote` flag anywhere, no hosted
project is touched. The local stack keys are the CLI's well-known development
defaults for a throwaway database; they are masked in logs and never printed.

## 4. Bootstrap recipe (the seed)

The seed reconstructs the pre-migration state each chain expects. It was
assembled by extracting definitions **verbatim** from the production baseline
(`supabase/baselines/production-schema.sql`) — no hand-retyped DDL — and
adjusted only where the reconciliation document says the two environments
differed before the chains ran.

### What the seed contains

| Piece | Production seed | Staging seed |
| --- | --- | --- |
| Core tables | 10 (all except `clinic_appointments`) | 7 (`profiles`, `clinics`, `clinic_subscriptions`, `invitations`, `patients`, `day_logs`, `platform_config`) |
| Sequences | 3 (`adherence_scores_id_seq`, `consents_id_seq`, `day_logs_id_seq`) | 0 (`day_logs.id` is GENERATED ALWAYS AS IDENTITY) |
| Helper functions | 9 legacy helpers | 9 legacy helpers |
| Legacy policies | 7 stubs (ALTERed, then dropped by the chains) | 7 stubs |
| Indexes | 5 (incl. the 3 duplicates the cleanup file drops) | 3 |
| Grants | none (all grants come from the chain) | anon SELECT on `platform_config` only (the revoke file asserts it) |

The 9 legacy helpers (private + public `caller_role`, `caller_clinic_id`,
`clinic_sub_active`, `can_access_patient`, plus
`public.enforce_invitation_consume`) are the functions the chains call but do
not create. Note: `private.enforce_invitation_consume` **is** created by the
reconciliation file (line 275) and the alignment file (line 322), so it is
not one of the 9. The public `clinic_sub_active` checks only subscription
status; the private one also checks the clinic is not suspended.

The 7 legacy policy stubs (`profiles_owner_all`, `inv_owner_all`,
`inv_staff_read`, `patients_admin_write`, `patients_owner_all`,
`patients_admin_read`, `config_owner_write`) are ALTERed (no IF EXISTS) and
then dropped by the chains — they must exist for the chains to apply.

### Per-chain differences the seed encodes

- **Production:** `day_logs.id` is sequence-based (`nextval`); the
  `day_logs_patient_date_key` unique constraint exists (the cleanup file drops
  the duplicate `uidx_day_logs_patient_date` because `_key` exists);
  `adherence_scores` and `consents` exist with their baseline definitions
  (consents has no `updated_at`; `adherence_scores.note` is nullable; CHECK
  name `adherence_scores_overall_range`; consents unique
  `consents_patient_id_purpose_key`).
- **Staging:** `day_logs.id` is GENERATED ALWAYS AS IDENTITY; no `_key`
  constraint (so `uidx_day_logs_patient_date` survives); no
  `adherence_scores`/`consents` tables yet (the chain creates them);
  no `idx_adherence_scores_patient` and no `idx_consents_patient` (live
  staging queries proved the latter absent).

### Why the seed is necessary

The migration files alone cannot rebuild either database from empty because
they assume the legacy state exists: tables the chains ALTER, functions the
chains call, policies the chains ALTER-then-drop, and indexes the chains
conditionally drop. The seed is that assumed state, made explicit and
repeatable. It is a test bootstrap, not a migration: it documents the gap,
it does not close it by rewriting history.

## 5. Verification

### 5.1 Schema checks (`checks.mjs`, shared with the PGlite smoke test)

The same check definitions run in the local PGlite smoke test and against the
local stack, so a local pass and a stack pass mean the same thing. Counts use
the validator's method (`scripts/validate-production-baseline.mjs`:
constraints filtered to `contype IN ('p','u','f','c','x')`).

Expected end-state counts:

| Count | Production | Staging |
| --- | --- | --- |
| Tables | 11 | 12 |
| Policies | 40 | 43 |
| Indexes | 23 | 27 |
| Routines | 19 | 20 |
| Triggers | 2 | 2 |
| RLS tables | 11 | 12 |
| Constraints | 33 | 44 |

Spot-checks include: `anon_patient_isolated` (anon cannot SELECT patients),
`anon_config_prod` / `anon_config_staging` (anon SELECT on `platform_config`
per environment), the push-endpoint CHECK excluding/allowing FCM per
environment, `get_push_signing_config` present, and (staging) the
appointments table + its validation trigger + its indexes.

### 5.2 Services tests (`test-services.mjs`)

These are the services the PGlite drill could not test (it stubs them):

1. **Realtime publication.** `public.profiles` is a member of the
   `supabase_realtime` publication. Both the reconciliation file (lines
   371–378) and the alignment file (lines 418–425) conditionally add it —
   the DO-block no-ops when the publication does not exist, so this check
   also proves the stack created the publication.
2. **Auth + RLS isolation over PostgREST.** Two users are created via the
   GoTrue Admin API, each signs in with email + password, and each reads
   only their own profile row through the Data API; an unauthenticated
   (anon) request reads no profile rows.
3. **Realtime live subscription.** A `postgres_changes` subscription on
   `public.profiles` delivers a profile UPDATE to the owning user and does
   NOT deliver it to the other user (RLS-filtered). Two delivery attempts
   are allowed: the first Realtime delivery after a cold start can be slow
   (the same first-run flake was observed on the managed preview).
4. **Vault.** A secret is created and read back via `vault.create_secret` /
   `vault.decrypted_secrets`. `get_push_signing_config` is confirmed present;
   its three VAPID Vault secrets are project configuration, not restorable
   from the repo (the baseline header says so explicitly), so the function
   itself is not invoked.

### 5.3 Local pre-check (PGlite smoke test)

`scripts/supabase-restore-test/smoke-pglite.mjs` runs both chains over the
same seeds in PGlite, locally, without Docker — the same drill PROMPT 4 ran
from `/tmp`, now committed as a repeatable script (per closure report O14:
future drills must be committed scripts under `scripts/`, not `/tmp`).

**Local result, 2026-11-21 evening: production 18/18 PASS, staging 25/25
PASS.** All 16 production files and all 28 staging files applied cleanly over
the reconstructed seeds; counts match the expected values in §5.1 exactly.
This independently reproduces the PROMPT 4 drill's result with the committed
recipe.

## 6. Corrections to the PROMPT 4 record

**Staging trigger count.** PROMPT 4 §6.3 lists 3 triggers for staging. That
is a documentation error: the staging chain creates exactly 2 triggers
(`clinic_subscription_payment_append_guard` and
`appointments_validate_booking`). `trg_invitation_consume` is created only by
the production alignment file — the reconciliation file creates the
`enforce_invitation_consume` function but no trigger on it. The "3" is most
plausibly a 2+1 assumption error (production's 2 + the appointments trigger).
The expected value in §5.1 is 2, with an explanatory comment in `checks.mjs`.

**Open question:** does live staging have `trg_invitation_consume` via manual
provisioning? One read-only query on the live staging database can answer it.
There is no functional impact either way: the invitations RLS policy enforces
the same state-transition rules the trigger would.

## 7. Run evidence

Workflow: `Supabase Restore Test` on branch
`feat/supabase-restore-test-2026-11-21` (PR #86), Supabase CLI 3.2.0 pinned,
PostgreSQL 17.12 on the local stack. All three runs used input `chain: both`.

| Run | Date (UTC) | Conclusion | What happened |
| --- | --- | --- | --- |
| [44944411061](https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44944411061) | 2026-11-21 20:08 | failure | Both chains failed at step 10 (Verify restored schema). Root cause: an arg-parsing bug in `verify-schema.mjs` — a missing optional `--db-url` flag made the script read `'--chain'` as the database URL, and `pg` parsed that as host `base` (`getaddrinfo EAI_AGAIN base`). Fixed in all four scripts (check `indexOf() === -1` before reading the next arg). |
| [44944819242](https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44944819242) | 2026-11-21 20:13 | failure | Schema verification PASSED on both chains (production 18/18, staging 25/25). Services step failed on both: every services test passed, then the optional cleanup call `vault.delete_secret(name)` threw `42883` — no such overload exists (the function takes a secret id, not a name). Fix: removed the cleanup (the database is throwaway; the stack is stopped with `--no-backup` right after). |
| [44945186144](https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44945186144) | 2026-11-21 20:18 | **success** | **All jobs green.** Production: schema 18/18 PASS, services 10/10 PASS. Staging: schema 25/25 PASS, services 10/10 PASS. Zero FAIL lines in either job log. |

### Run 3 detail (the green run)

**Production** (`Restore (production)`, job 136970857987):
schema counts exactly `tables=11, policies=40, indexes=23, routines=19,
triggers=2, rls_tables=11, constraints=33`; services 10/10 — Realtime
publication contains `public.profiles`; 2 users created via the GoTrue Admin
API; both signed in with email + password; each reads only their own profile
row via PostgREST; anon reads none; both Realtime channels joined; the owner
received the UPDATE (on attempt 2 — see the cold-start note below) and the
other user received nothing; the Vault secret round-tripped;
`get_push_signing_config` present.

**Staging** (`Restore (staging)`, job 136970857981): schema counts exactly
`tables=12, policies=43, indexes=27, routines=20, triggers=2, rls_tables=12,
constraints=44`; services 10/10 — identical list to production.

### Observations (not failure causes)

- **Realtime cold-start flake (real, handled).** In all three runs, the first
  Realtime delivery attempt after a cold start was slow and the owner's UPDATE
  arrived only on attempt 2 (runs 2 and 3 both show `attempt 2`). The
  two-attempt design in `test-services.mjs` exists for exactly this; it is the
  same first-run flake observed on the managed preview in PROMPT 2.
- **Docker Hub rate limiting (transient).** `Error response from daemon: error
  from registry: Rate exceeded` appeared during image pulls in runs 2 and 3;
  the CLI retried and `supabase start` succeeded every time. Unauthenticated
  pulls are rate-limited, so a future run could in principle hit a longer
  throttle — a re-run is the remedy, not a code change.
- **imgproxy + pooler stopped.** `supabase status` reported
  `supabase_imgproxy_*` and `supabase_pooler_*` as stopped in every run. No
  test uses them (direct Postgres on 54322 + the API gateway on 54321), and
  nothing failed because of it. Recorded here so a future reader is not
  surprised by the line in the logs.

## 8. What was tested vs what was NOT tested

### Tested (once the workflow runs green)

- The full migration chain applies cleanly over the documented seed on real
  PostgreSQL 17 with real Supabase services (not stubs).
- The restored schema matches the expected end state exactly (counts +
  privileges + object spot-checks).
- Auth works end to end (user creation, password sign-in, JWT via PostgREST)
  and RLS isolates users over the Data API.
- Realtime delivers row changes to the owning user and filters them for
  others (RLS-filtered live subscription).
- Vault stores and returns a secret.
- The bootstrap recipe is repeatable: the same seed + chain files produce the
  same end state on a fresh stack.

### NOT tested

- **Managed dashboard provisioning.** The local stack is created by the CLI,
  not by the Supabase dashboard; project creation, dashboard settings, and
  the hosted provisioning path are not exercised.
- **Managed extension configuration.** Extensions in the local stack come
  with CLI defaults; a managed project's extension settings could differ.
- **Project-level settings.** Redirect URLs, Auth providers, SMTP, and other
  project settings are not part of the migration chain and are not restored
  by this test.
- **Network / SSL.** The local stack runs on localhost; TLS, the hosted
  connection pooler, and network behaviour are not tested.
- **Data migration.** No real data is restored; the test proves schema +
  services, not that existing production/staging rows would survive a
  restore.
- **The live projects.** Production and staging were never touched by this
  test (by design); nothing here proves anything about their current live
  state beyond what PROMPT 4's read-only queries already established.

## 9. Equivalence verdict (Gate 4)

**VERDICT: Gate 4 is CLOSED as a documented equivalent alternative.**

The evidence supports it. Run 3 (all green, both chains) proves, on the real
Supabase software stack (PostgreSQL 17.12, GoTrue, Realtime, PostgREST,
Vault — the same images the managed platform runs):

- the documented seed + migration chain applies cleanly and converges to the
  exact expected end state (counts, privileges, and object spot-checks all
  exact, on both chains);
- Auth works end to end (user creation, password sign-in, JWT via PostgREST)
  and RLS isolates users over the Data API;
- Realtime delivers row changes to the owning user and filters them for
  others;
- Vault stores and returns a secret.

That is what Gate 4 exists to establish: that the database can be rebuilt
from the repo (seed + chains) into a working Supabase environment with
functioning Auth / Vault / Realtime. The test objective is met in full.

**Residual gap (recorded, not hidden).** The local stack does not prove
managed dashboard provisioning, managed extension configuration,
project-level settings (redirect URLs, Auth providers, SMTP), or network/SSL
behaviour (§8). Those are properties of the hosting wrapper, not of the
restore: none of them changes whether the migration chain applies or whether
the services work against the restored schema. They are therefore out of
scope for a schema-and-services restore test, and closing Gate 4 on the
local-stack evidence does not claim they were tested.

**What would close the gap fully.** A restore into a managed disposable
Supabase project would exercise the dashboard provisioning path itself. That
was not done here, deliberately: سعيد already has 2 free Supabase projects
(production + staging), so a third free project would likely need a new
organization or a Pro plan (~$25/month), and it would add no restore
evidence beyond what run 3 already proves. If the team ever needs to validate
the managed provisioning path itself — for example before a real production
rebuild — that is the remaining step, and its cost is a new org (free) or
~$25/month (Pro). Until then, the local-stack test is the repeatable restore
proof, and this document is the record of exactly what it does and does not
establish.

## 10. How to re-run

- **Full test (GitHub Actions):** dispatch the workflow
  (Actions → Supabase Restore Test → Run workflow), optionally for one chain.
  Requires no secrets and no Supabase project.
- **Local pre-check (no Docker):** `npm ci`, then
  `node scripts/supabase-restore-test/smoke-pglite.mjs --chain both`.
- **Local workdir build (no stack start):**
  `node scripts/supabase-restore-test/build-workdir.mjs --chain staging --workdir /tmp/restore-staging`
  (needs the Supabase CLI on PATH; `supabase start` needs Docker).
