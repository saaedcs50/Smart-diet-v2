-- Legacy public helper duplicates are not part of the client API.
-- RLS policies and database functions use the private-schema helpers instead.

BEGIN;

REVOKE ALL ON FUNCTION public.caller_role()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.caller_clinic_id()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
