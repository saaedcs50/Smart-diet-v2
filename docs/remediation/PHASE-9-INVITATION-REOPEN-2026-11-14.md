# Phase 9 — Invitation management and safe re-open

Date: 2026-11-14

## Implemented

- Added a clinic invitation list for clinic admins and a creator-scoped invitation list for coaches.
- Admins can re-open consumed coach/patient invitations within their clinic.
- Coaches can re-open only patient invitations they created.
- Patients cannot see or trigger a re-open action.
- Re-open requires explicit in-UI confirmation, updates only a `consumed` row, and reports when no authorized row was changed.
- No email is sent automatically; the UI explicitly says staff must inform the invitee manually.

## Authorization verification

- Inspected the live `invitations` RLS policies and `private.enforce_invitation_consume()` trigger in both Staging and Production.
- The live trigger enforces immutable email, role, clinic, and creator; invitees may only transition pending → consumed; authorized staff may re-open consumed → pending.
- RLS further limits admins to their clinic and coaches to patient invitations they created. The client helper only mirrors this for presentation; database RLS and trigger remain authoritative.
- The older `docs/remediation/PR34-DRIFT-ANALYSIS.md` describes prior live drift and is stale for the current private trigger. Production still has an unused legacy `public.enforce_invitation_consume()` function; the attached trigger references the private function.
- No schema migration or live policy change was needed in this phase.

## Verification status

- Unit coverage added for the invitation eligibility helper and created-at parsing.
- A Staging role-matrix and a targeted transaction test should be run in CI before merge.
