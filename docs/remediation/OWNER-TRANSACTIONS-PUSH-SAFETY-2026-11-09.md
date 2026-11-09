# Smart Diet v2 — owner transactions and Web Push safety gate

**Date:** 2026-11-09  
**Environment validated:** Supabase Staging only (`dubevgijagqjgwcibqeo`)  
**Branch:** `codex/p0-owner-transactions-and-disable-plaintext-push`

## Owner operations made atomic

The owner UI previously wrote a clinic, then an invitation, then a subscription as three independent requests. A failure in the middle could leave orphaned business records. Payment review also read a JSON array in the browser and wrote the modified array back, allowing concurrent reviews to overwrite one another.

The Staging database now provides two authenticated RPCs:

- `owner_create_clinic_with_owner`: checks that the current JWT belongs to an enabled `owner`, validates the clinic/owner fields, then creates the clinic, initial expired subscription, and pending admin invitation in one transaction. An email invitation conflict aborts the entire transaction.
- `owner_review_clinic_payment`: checks the current actor's owner role, locks the subscription row with `FOR UPDATE`, validates the payment record and state, then updates subscription status and payment review metadata as one operation. Audit attribution comes from `auth.uid()`, not a caller-supplied UID.

Both RPCs run as `SECURITY INVOKER`, not `SECURITY DEFINER`: their explicit owner checks and the existing owner RLS policies are enforced under the caller's own privileges. Staging smoke tests passed after this change, and the Supabase Security Advisor no longer reports the two owner RPCs.

The React owner dashboard now calls these RPCs and no longer passes actor IDs to the write functions.

## Web Push deliberately disabled

The checked-in `notify` implementation does not yet encrypt request payloads using the Web Push `aes128gcm` content encoding required by RFC 8291. Until a correct encryption implementation, test vectors, and delivery tests exist:

- the application does not request browser notification permission;
- it does not create or store new browser push subscriptions;
- the clinician notification action is replaced by an explanatory disabled-state message; and
- `notifyPatient` rejects before making any network request.

A regression test asserts the delivery gate remains disabled and no request is sent.

Existing historical subscriptions are not deleted. Re-enabling Push requires a separate reviewed change that implements and tests RFC 8291 end-to-end.

## Staging smoke tests

Synthetic owner/admin identities and clinic/payment records were used inside a transaction that was rolled back. Verified behavior:

- a platform owner can create the clinic, subscription, and pending admin invitation together;
- payment approval updates the subscription and writes `reviewedAt` / `reviewedBy`;
- payment rejection records the review metadata and rejection note;
- duplicate review, null action, null activation plan, and non-owner clinic creation are rejected; and
- all synthetic owner/admin profile, clinic, and invitation records were absent after rollback.

No live owner, clinic, subscription, payment, or patient record was changed by these tests.

## Remaining release blockers

1. Production Supabase remains INACTIVE; the Production Vercel project still targets it.
2. `VITE_PLATFORM_ENABLED` remains empty. The existing Staging owner profile does not use `clinic_id='platform'`; do not remap it without confirming its account identity.
3. A canonical clean-room Supabase baseline and migration-history reconciliation are still needed; the first schema reconciliation applied to the manually provisioned Staging database only.
4. The existing multiple-permissive-policy warnings on legacy tables require per-table security review.
5. Local browser data is currently namespaced by brand/clinic build, not authenticated patient UID. Account-switching isolation still requires a backwards-compatible migration and logout handling.
6. Phase 7 doctor exports (CSV, Excel, PDF) remain unimplemented.
7. Full authenticated role × table × command RLS matrix tests need to be added to CI.
8. Leaked-password protection remains disabled in Supabase Auth; enable after assessing password policy impact.

**Release decision:** owner writes are now atomic on Staging and plaintext Web Push is disabled. Production rollout remains **NOT APPROVED** until the blockers above are cleared.
