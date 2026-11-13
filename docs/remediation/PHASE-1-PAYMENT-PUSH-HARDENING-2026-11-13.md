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

## Staging verification — 2026-11-13

The migration was applied to Supabase Staging only. Its recorded versions are:
- `20261113020248_atomic_clinic_payment_requests`
- `20261113020409_consolidate_clinic_subscription_update_policy`

Transaction-scoped tests using the existing synthetic Staging admin identity verified:
- one payment request is appended;
- a repeat using the same request UUID leaves exactly one matching record;
- `submittedBy` matches `auth.uid()`;
- a different second pending request is rejected;
- a direct admin attempt to change subscription status is rejected; and
- a coach cannot call the payment submission RPC.

Each test transaction ended with `ROLLBACK`; a follow-up check found no smoke-test request ID persisted. The owner's existing UPDATE policy and the new admin payment-request policy were consolidated into one UPDATE policy after Supabase Performance Advisor reported multiple permissive policies. The follow-up Advisor run no longer reports that finding.

Remaining Advisor findings after the change:
- Security: leaked-password protection remains disabled (pre-existing project setting; not changed here).
- Performance: seven pre-existing unused-index informational findings remain; no indexes were removed.
- Health: no findings.

Production was not modified. The Production migration ledger is still intentionally untouched.

## Acceptance criteria

1. Direct POST to the Edge Function returns 503 while Push is disabled and makes no outbound Web Push call.
2. An enabled admin can submit one payment request for their own clinic.
3. Repeating the same request UUID does not append another payment.
4. A concurrent second pending request is rejected without losing the first.
5. Coach, patient, disabled admin, and cross-clinic requests are rejected.
6. An admin cannot alter subscription status, plan, expiry, or prior payment records through direct table updates.
7. Owner approve/reject workflows continue to work unchanged.
