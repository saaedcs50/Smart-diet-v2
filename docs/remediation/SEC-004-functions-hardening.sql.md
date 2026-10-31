# SDV2-SEC-004 — Hardening SECURITY DEFINER Functions

**Status:** DOCUMENTED — SQL to be applied via Supabase dashboard

## Required SQL

```sql
-- Fix search_path for all 4 SECURITY DEFINER functions
ALTER FUNCTION public.caller_role() SET search_path = '';
ALTER FUNCTION public.caller_clinic_id() SET search_path = '';
ALTER FUNCTION public.clinic_sub_active(text) SET search_path = '';
ALTER FUNCTION public.can_access_patient(uuid) SET search_path = '';

-- Revoke EXECUTE from anon where not needed
-- caller_role, caller_clinic_id, can_access_patient are used in RLS policies
-- (called by Postgres during RLS evaluation, not directly by anon)
-- clinic_sub_active is callable and exposes subscription state — restrict it
REVOKE EXECUTE ON FUNCTION public.clinic_sub_active(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinic_sub_active(text) FROM authenticated;

-- If clinic_sub_active must remain callable, create a wrapper that scopes to caller's clinic:
-- (Alternative: keep as-is but document the enumeration risk)
```

## Rationale

- `search_path = ''` prevents search_path poisoning attacks where a malicious user creates a table/function in a schema earlier in the path to hijack the DEFINER function's object resolution.
- `clinic_sub_active(cid)` accepts any clinic ID and returns a boolean — an authenticated user could enumerate subscription status for clinics they don't belong to. Revoking from anon/authenticated forces all access through RLS policies which properly scope to the caller's clinic.

## Verification

```sql
SELECT proname, prosecdef, proconfig FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND prosecdef = true;
-- proconfig should contain {search_path=}
```
