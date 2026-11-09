# Smart Diet v2 — RLS policy consolidation and live role matrix

**Date:** 2026-11-09  
**Environment:** Supabase Staging only (`dubevgijagqjgwcibqeo`)  
**Branch:** `codex/p8-consolidate-rls-actions`

## What changed

The Staging catalog had multiple permissive policies on the same table/action/role. Some duplicated the same authorization predicate and others represented separate branches of the same role model.

Migration `20261109074419_consolidate_remaining_rls_policies.sql` now uses one policy per command for:
- `patients`: one SELECT, INSERT, UPDATE and DELETE policy combining owner, same-clinic admin, own assigned coach, and patient-self access as applicable.
- `invitations`: one SELECT, INSERT and UPDATE policy for owner, staff and invitee branches, plus owner-only DELETE. The invitation trigger remains responsible for immutable identity fields and valid state transitions.
- `profiles`: one SELECT policy for owner/admin-in-clinic/self, one INSERT policy for owner or invitation-claiming self, and owner-only UPDATE/DELETE.
- `platform_config`: owner-only writes.

Migration `20261109074506_split_platform_config_read.sql` separates public reads from authenticated-owner reads:
- `anon` can read only rows marked `value.public = true`.
- `authenticated` can read public rows and all rows when the caller is the platform owner.
- There are no policies assigned to the broad `PUBLIC` role.
- `anon` has no SELECT grant on profiles, patients, invitations, or day logs.

## Live Staging role matrix

A transaction inserted synthetic profiles, patient rows, day logs, invitations, and platform config; switched JWT identities under `SET LOCAL ROLE`; captured results; then rolled back.

**33/33 assertions passed** across:
- `anon`: public config visible; private config hidden.
- `coach`: own clinic and subscription readable; only assigned patients and logs visible; own patient update allowed; other-patient update hidden; clinic/subscription writes denied; other profiles hidden; coach cannot invite another coach.
- `patient`: own profile/patient/day log visible; another patient's profile and clinical rows hidden.
- Invitee: exact matching invitation permits creation of the patient profile and consumption of that invitation.
- `admin`: team profiles, own clinic and subscription visible; clinic update allowed; subscription update denied.
- `owner`: all clinic/subscription rows and private platform config visible; subscription update allowed.

After rollback, queries confirmed zero synthetic records remained.

## Advisor results after consolidation

- Security: one warning remains — Supabase Auth leaked-password protection is disabled.
- Performance: zero multiple-permissive-policy findings; seven unused-index informational findings remain.
- Health: no findings.
- RLS: all 11 platform tables remain enabled.
- Grants: anon cannot read the private clinic/patient tables; service_role has no TRUNCATE.

## Remaining blockers

- The full matrix above is a direct Staging SQL integration test, not yet a reusable dedicated CI integration suite. A separate Supabase branch costs `$0.01344/hour`; it has not been created without explicit cost approval.
- Production Supabase remains INACTIVE. Production Vercel points to it; no production variables/deployments have been changed.
- The platform owner account identity and `clinic_id='platform'` mapping remain unresolved and were not modified.
- A clean-room canonical baseline migration still needs to be constructed and tested against an isolated restore.
- Leaked-password protection remains disabled and needs a deliberate Auth settings change.
- Full per-UID localStorage/IndexedDB namespacing remains open; current guard only blocks cross-account cloud sync.
