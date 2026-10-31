# SDV2-OWNER-001 — Clinic Provisioning Atomicity

**Status:** DOCUMENTED — Partial fix applied (see below)

## Problem

`createClinicWithOwner()` in `src/platform/owner.ts`:
1. Creates clinic with `owner_uid: ''` (empty!)
2. Creates invitation (separate operation)
3. Creates subscription (separate operation)

If step 2 or 3 fails, the clinic is left in a partial state. Additionally, `owner_uid` is NEVER updated after the owner registers — it stays `''` forever.

## Root Cause

The invitation is created with `role: 'admin'`, not a distinct owner role. When the owner registers via the invitation flow, there's no code that links their UID back to the clinic's `owner_uid` field.

## Recommended Fix (Full)

Create a PostgreSQL RPC function `provision_clinic()` that runs in a single transaction:

```sql
CREATE OR REPLACE FUNCTION provision_clinic(
  p_name TEXT,
  p_owner_name TEXT,
  p_owner_email TEXT,
  p_owner_phone TEXT,
  p_created_by UUID
) RETURNS TEXT AS $$
DECLARE
  v_clinic_id TEXT;
BEGIN
  v_clinic_id := 'clinic-' || to_char(now(), 'YYYYMMDDHH24MISSMS');
  
  INSERT INTO clinics (id, name, owner_uid, owner_name, owner_phone, status)
  VALUES (v_clinic_id, p_name, '', p_owner_name, p_owner_phone, 'active');
  
  INSERT INTO invitations (email, role, clinic_id, created_by, status)
  VALUES (lower(p_owner_email), 'admin', v_clinic_id, p_created_by, 'pending');
  
  INSERT INTO clinic_subscriptions (clinic_id, plan, status)
  VALUES (v_clinic_id, 'monthly', 'expired');
  
  RETURN v_clinic_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then, when the owner registers, update the clinic:
```sql
-- In the registration completion handler:
UPDATE clinics SET owner_uid = :new_uid 
WHERE id = :clinic_id AND owner_uid = '';
```

## Minimal Fix Applied

Added `linkClinicOwner()` helper in `owner.ts` — call it after the invited owner completes registration to populate `owner_uid`. This doesn't make the creation atomic, but fixes the permanent empty UID.
