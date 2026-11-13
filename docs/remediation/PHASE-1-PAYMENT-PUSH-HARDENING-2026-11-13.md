# Phase 1 — Payment request and Web Push hardening

**Date:** 2026-11-13  
**Branch:** `fix/phase1-payment-push-hardening-2026-11-13`  
**Environment changes in this PR:** none; this branch contains code and migration changes only.

## 1. Web Push fail-closed at the server boundary

The browser already had a disabled flag, but the Supabase Edge Function could still be called directly and contained a plaintext JSON payload send path.

This change adds an independent server-side switch in `supabase/functions/notify/pushGate.ts` and returns HTTP 503 for POST requests while the switch is false. `sendWebPush` also checks the switch before any endpoint call. The browser and server tests assert that both switches remain disabled.

No existing subscription rows are deleted. Push must remain disabled until RFC 8291 `aes128gcm` encryption, standards test vectors, and end-to-end delivery tests exist.

## 2. Atomic renewal payment requests

The browser no longer reads `clinic_subscriptions.payments`, appends in memory, and writes the full JSON array back. It now calls `submit_clinic_payment_request` with a stable request UUID.

The new invoker function:
- requires a signed-in, enabled `admin` profile;
- derives the submitter from `auth.uid()`, not a client-supplied UID;
- requires the target clinic to match the caller's clinic;
- validates method, finite positive amount, reference and note length;
- locks the subscription row with `FOR UPDATE`;
- treats the request UUID as an idempotency key;
- rejects a second pending payment request; and
- appends the payment record in the same database transaction.

To keep the function as `SECURITY INVOKER`, the migration adds an admin-only UPDATE policy and a trigger. The trigger permits admins to append exactly one valid request, but blocks changes to subscription plan/status/dates, clinic identity, and existing payment history. Existing owner subscription operations remain permitted.

Only clinic admins are shown the renewal submission form. Coaches and patients are directed to contact their clinic admin.

## 3. Validation status

- Unit tests now assert the browser uses the RPC contract and never performs payment-array read/modify/write.
- Unit tests assert the browser and Edge Function kill switches are both false.
- GitHub Actions and Vercel Preview must pass before merge.
- The migration must be applied to Staging first, followed by a transaction-scoped test using synthetic identities/rows and a post-migration Supabase Advisor review.
- Production migration/deployment is intentionally not included. Production's migration ledger differs from Staging and must be handled under the documented clean-room/reconciliation procedure.

## Staging and Production verification — 2026-11-13

### Supabase Staging

The following migrations were recorded in the Staging ledger:
- `20261113020248_atomic_clinic_payment_requests`
- `20261113020409_consolidate_clinic_subscription_update_policy`
- `20261113022823_harden_payment_request_idempotency`
- `20261113022850_fix_payment_request_jsonb_keys`
- `20261113023420_remove_duplicate_production_indexes`
- `20261113023617_secure_patient_subscription_gate`

Transaction-scoped tests using the existing synthetic Staging admin identity verified:
- one payment request is appended;
- a repeat using the same request UUID and identical data leaves one record;
- reusing the same UUID with different payment data is rejected;
- a different second pending request is rejected;
- two concurrent requests with different UUIDs serialize, so only one pending request is accepted;
- `submittedBy` is derived from `auth.uid()`;
- a direct admin attempt to change subscription status is rejected;
- a coach and a cross-clinic admin request are rejected; and
- direct append attempts cannot backdate `submittedAt` or add unapproved JSON fields.

The concurrent smoke test's temporary row was removed. Follow-up checks confirmed no test payment rows remained. Owner subscription review still works. The RLS update policy is consolidated into one policy for owner/admin.

### Supabase Production

Production received the same four payment-request migrations. The actual remote ledger versions are:
- `20261113023307_atomic_clinic_payment_requests`
- `20261113023310_consolidate_clinic_subscription_update_policy`
- `20261113023312_harden_payment_request_idempotency`
- `20261113023315_fix_payment_request_jsonb_keys`
- `20261113023422_remove_duplicate_production_indexes`
- `20261113023618_secure_patient_subscription_gate`

The Production schema was inspected before applying them: required tables, columns, caller helper functions and owner RLS policies were present. Production currently has one owner profile, zero clinics, zero patients and zero subscriptions; no business records were created or altered. The payment RPC, append-guard trigger and single UPDATE policy are now present.

The deployed Production `notify` Edge Function is now **version 4** with JWT verification still enabled. Its source includes the server-side `PUSH_DELIVERY_ENABLED = false` gate and returns HTTP 503 for direct POST calls before request processing. This closes the plaintext Web Push send path on the live function. Push remains unavailable until RFC 8291 encryption, standards test vectors, and end-to-end tests are completed.

The patient subscription-gate read was also deployed to both projects. A narrowly scoped `SECURITY DEFINER` lookup inside the non-exposed `private` schema is reached through an authenticated `SECURITY INVOKER` RPC. It returns only plan/status/date fields for the caller's own clinic; it never returns the `payments` JSONB field. Staging tests verified active and grace state for two patients and rejected a cross-clinic lookup. Direct patient SELECT on `clinic_subscriptions` remains denied.

### Database Advisor results

- Staging Performance Advisor: the multiple-permissive-UPDATE warning is gone; its remaining unused-index notices are unchanged.
- Production Performance Advisor: four confirmed duplicate indexes with no attached constraints were removed, preserving the canonical indexes and the unique constraint index. The duplicate-index warnings disappeared; six unused-index informational notices remain.
- Production Security Advisor: leaked-password protection remains disabled (pre-existing setting; not changed here).
- Production Health Advisor: no findings.

### Migration-ledger note

Staging and Production already had different historical migration ledgers before this work because their original schemas were provisioned through different procedures. The new migrations were applied successfully to both projects, but their remote version numbers differ because they were applied at different times. A reproducible clean-room baseline and a formal migration-ledger reconciliation are still release-engineering tasks; do not run a blind `supabase db push` across these environments until that reconciliation is complete.

## Acceptance criteria

1. Direct POST to the Edge Function returns 503 while Push is disabled and makes no outbound Web Push call.
2. An enabled admin can submit one payment request for their own clinic.
3. Repeating the same request UUID does not append another payment.
4. A concurrent second pending request is rejected without losing the first.
5. Coach, patient, disabled admin, and cross-clinic requests are rejected.
6. An admin cannot alter subscription status, plan, expiry, or prior payment records through direct table updates.
7. Owner approve/reject workflows continue to work unchanged.
