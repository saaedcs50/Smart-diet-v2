# PR34 Migration Drift Analysis

**Date:** 2026-11-01
**Audit reference:** `SMART_DIET_V2_PR34_INDEPENDENT_REVIEW_1_vyn9.md` (P1-4)
**Committed migration:** `supabase/migrations/20261101000000_p0_security_fixes.sql`
**Live project:** `smart-diet-platform` (`lhjyshlxbsnesayivxpb`)

## Summary

The P0 security SQL was applied manually through the Supabase Dashboard SQL Editor
(browser tasks), not through a migration tool. The committed migration file was written
to document the *intended* fixes, but the live database objects differ from the committed
SQL in several material ways. Supabase `list_migrations` returns an empty list, and
`supabase_migrations.schema_migrations` is absent — there is no recorded migration history.

**Consequence:** a fresh database built from the committed migrations would NOT reproduce
the live production security model. The live DB is the source of truth, but it is not
reproducibly represented in the repository.

## Drift item 1 — `profiles_self_insert` role allowlist

| | Committed migration | Live database |
|---|---|---|
| Policy | `profiles_self_insert` | `profiles_self_insert` |
| WITH CHECK | `id = auth.uid() AND role = 'patient' AND disabled = false` | `id = auth.uid() AND role = ANY (ARRAY['patient','coach','admin']) AND disabled = false` |

**Impact:** The live policy still permits an authenticated user to self-insert a profile with
`role = 'coach'` or `role = 'admin'` and an arbitrary `clinic_id`. The `owner` role is
blocked in both. The committed migration is *stricter* (patient-only) than live.

**Why it drifted:** the dashboard SQL applied during the PR33 follow-up used the wider
allowlist; the migration file was written afterward with the narrower intent.

**Required:** decide the intended policy (recommendation: patient-only self-insert, staff
roles provisioned server-side via invitation validation), then align both live and
committed SQL to it. See P0-1 in the PR34 review.

## Drift item 2 — Invitation consume trigger (name and behavior)

| | Committed migration | Live database |
|---|---|---|
| Function | `public.enforce_invitation_immutable_cols()` | `public.enforce_invitation_consume()` |
| Trigger | `trg_invitation_immutable_cols` | `trg_invitation_consume` |
| service_role bypass | Yes (`request.jwt.claims` role check) | No |
| Status transition | Not enforced (only column immutability) | Enforces `pending → consumed` only; **rejects all other transitions** |

**Impact:** the live trigger blocks `reopenInvitation()` (`consumed → pending`), even for
owners, and blocks upsert-resend flows that reset a consumed invitation to `pending`.
The committed migration permits re-open (it only guards column immutability) and allows
`service_role` to bypass. Application code comments explicitly support re-opening
consumed invitations — the live behavior contradicts the application.

**Why it drifted:** the dashboard SQL was written as a stricter one-way consume; the
migration file was written with the more permissive design.

**Required:** define explicit authorized transitions per actor (invitee: pending→consumed
only; staff/owner or server: consumed→pending re-open allowed). See P1-1 in the PR34 review.

## Drift item 3 — No recorded migration history

- `supabase_migrations.schema_migrations` does not exist in the live project.
- The Supabase Dashboard "Migrations" list is empty.
- Both the baseline (`20261031000000_baseline.sql`, comment-only inventory) and the P0
  migration were applied (or partially applied) by pasting SQL into the Dashboard editor.

**Impact:** there is no auditable record of which migrations were applied, in which order,
or whether the live schema matches any committed state. Rollback, staging parity, and
disaster recovery from migrations are impossible.

## Drift item 4 — Manual dashboard application process

All P0 SQL (policies, triggers, function hardening, TRUNCATE revokes, config_read_public)
was applied via ad-hoc browser tasks running SQL in the Dashboard editor, with verification
queries run separately. This process:

1. Leaves no artifact linking a specific SQL text to a specific application event.
2. Allows the "write migration file after the fact" pattern that produced items 1–2.
3. Cannot be re-run idempotently against a fresh project without manual reconciliation.

## Recommendation

1. **Freeze the intended SQL.** For each drifted object, decide the intended definition
   (see P0-1 and P1-1 remediation in the PR34 review) and write it as a single
   authoritative migration.
2. **Reconcile live to the migration.** Apply the authoritative migration to the live
   project via the Dashboard (one final manual application), verifying each object
   matches the committed text exactly (compare `pg_policies`, `pg_trigger`,
   `pg_proc`, ACLs).
3. **Establish a baseline marker.** Once live == committed, record the migration as
   applied (e.g. insert into a `schema_migrations`-equivalent or document the
   "baseline verified at commit X" in `docs/remediation/`), so future migrations are
   deltas from a known state.
4. **Going forward:** all schema changes go through committed migration files FIRST,
   applied via a repeatable process; never write the migration after pasting SQL.
5. **Add a drift check to CI** (extends the existing `rls-policy-check` job): parse the
   expected policy/trigger/function definitions from migrations and fail if a future
   change edits live SQL without updating the migration (requires a test project or
   nightly live-catalog snapshot comparison — dashboard read-only queries suffice).

## Verification queries (for the reconciliation step)

```sql
-- 1. profiles_self_insert check clause
SELECT with_check FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'profiles'
   AND policyname = 'profiles_self_insert';

-- 2. invitation trigger + function names
SELECT trigger_name, action_statement FROM information_schema.triggers
 WHERE event_object_schema = 'public' AND event_object_table = 'invitations';
SELECT proname, proconfig FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname LIKE 'enforce_invitation%';

-- 3. function ACLs (no PUBLIC execute on SECURITY DEFINER helpers)
SELECT proname, proacl FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('caller_role','caller_clinic_id','clinic_sub_active','can_access_patient');

-- 4. TRUNCATE grants on public tables
SELECT table_name, grantee FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND privilege_type = 'TRUNCATE'
   AND grantee IN ('anon','authenticated');
-- expect zero rows
```
