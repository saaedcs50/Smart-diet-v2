# SDV2-OWNER-002 — Payment Concurrency Analysis

**Status:** DOCUMENTED — Implementation deferred (requires schema change)

## Problem

Payment requests are stored as a JSONB array in `clinic_subscriptions.payments`. The code does:
1. READ the subscription row
2. Modify the payments array in memory
3. WRITE the entire array back

If two requests happen simultaneously, one can overwrite the other (lost update).

## Locations

- `src/platform/subscription.ts:68-108` — `submitActivationRequest()`
- `src/platform/owner.ts:109-190` — payment approval

## Recommended Fix

### Option A: Normalized table (preferred)

Create a `payment_requests` table:

```sql
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id TEXT NOT NULL REFERENCES clinics(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  method TEXT NOT NULL, -- 'instapay' | 'vodafone_cash'
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  idempotency_key TEXT UNIQUE NOT NULL,
  submitted_by UUID,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  note TEXT
);
```

Benefits:
- Each payment is a separate row (no read-modify-write)
- Idempotency key prevents duplicates
- Status transitions are explicit and auditable
- Can use SELECT FOR UPDATE for approval

### Option B: RPC with row locking (minimal change)

```sql
CREATE OR REPLACE FUNCTION append_payment(
  p_clinic_id TEXT,
  p_payment JSONB,
  p_idempotency_key TEXT
) RETURNS VOID AS $$
DECLARE
  v_payments JSONB;
BEGIN
  -- Lock the row
  SELECT payments INTO v_payments FROM clinic_subscriptions
  WHERE clinic_id = p_clinic_id FOR UPDATE;
  
  -- Check idempotency (payment with same key already exists)
  IF v_payments @> jsonb_build_array(jsonb_build_object('idempotencyKey', p_idempotency_key)) THEN
    RETURN; -- Already processed
  END IF;
  
  -- Append
  UPDATE clinic_subscriptions
  SET payments = v_payments || p_payment,
      updated_at = NOW()
  WHERE clinic_id = p_clinic_id;
END;
$$ LANGUAGE plpgsql;
```

## Why Deferred

Requires either a schema migration (new table) or a new RPC function, plus updating all call sites and adding concurrency tests. The current risk is MEDIUM (requires simultaneous submissions to the same clinic, which is rare in practice).
