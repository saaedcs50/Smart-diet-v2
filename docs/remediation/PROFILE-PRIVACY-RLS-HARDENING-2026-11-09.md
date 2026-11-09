# Smart Diet v2 — profile privacy and RLS CI hardening

**Date:** 2026-11-09  
**Environment:** active Supabase Staging only (`dubevgijagqjgwcibqeo`)  
**Branch:** `codex/p8-tighten-profile-visibility`

## Finding

The prior `profiles_staff_clinic_read` policy allowed both `admin` and `coach` roles to select every `profiles` row in the caller's clinic. That policy was broader than the app's role model: a coach should see their own profile and assigned patients' patient records, but should not enumerate other coaches' or patients' profile records.

A repository review showed `listClinicStaffEntries(clinicId)` is the clinic staff roster query used by the admin dashboard. Coach authentication fetches only the current user's profile by `id = auth.uid()`.

## Applied changes

Migration `20261109072358_profiles_admin_only_visibility`:

- Drops `profiles_staff_clinic_read`.
- Creates `profiles_admin_clinic_read` for `authenticated` users with role `admin` and matching `clinic_id`.
- Moves `profiles_owner_all` from `PUBLIC` to `authenticated`.
- Keeps `profiles_self_read` unchanged so each user can still read their own row.

Migration `20261109072730_explicit_rls_all_platform_tables` explicitly enables RLS on all 11 platform tables.

## Live Staging test

A rolled-back transaction created synthetic admin, coach A, coach B, and patient profiles in one active clinic, then switched JWT claims under `SET LOCAL ROLE authenticated`:

- Coach A: own profile visible; admin, other coach, and patient profiles not visible.
- Admin: own profile visible; all profile rows in its clinic visible (team roster).
- A subsequent query confirmed no synthetic `be000000-*` profiles remained after rollback.

## CI improvement

The old RLS job only searched the comment/inventory baseline for table names. It did not establish that migrations contain RLS enablement or policies.

The new `scripts/check-supabase-rls.mjs` checks all 11 expected table names against:
- the explicit RLS enablement manifest; and
- actual `CREATE POLICY ... ON public.<table>` statements across SQL migrations.

This remains a **static** check. It does not replace the pending live role × table × command integration matrix.

## Advisor state after changes

- Security Advisor: one warning — Supabase Auth leaked-password protection disabled.
- Health Advisor: no findings.
- Performance Advisor: 49 multiple-permissive-policy notices and 7 unused-index informational findings remain. These are being tracked; unused indexes are not dropped without workload evidence.

## Release boundaries

No production database, production Vercel environment, account mapping, or live patient record was changed. The existing platform-owner profile mapping remains unconfirmed. A clean-room baseline and a separately funded isolated Supabase branch for the complete live RLS matrix are still pending.
