-- PRIV/SEC: clinic staff must not enumerate every patient's profile row.
-- The admin team screen is the only client consumer of the clinic-wide query.
-- Coaches and patients may read only their own profile row.

BEGIN;

DROP POLICY IF EXISTS profiles_staff_clinic_read ON public.profiles;

CREATE POLICY profiles_admin_clinic_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.caller_role()) = 'admin'
    AND clinic_id = (SELECT private.caller_clinic_id())
  );

ALTER POLICY profiles_owner_all
  ON public.profiles
  TO authenticated;

COMMIT;
