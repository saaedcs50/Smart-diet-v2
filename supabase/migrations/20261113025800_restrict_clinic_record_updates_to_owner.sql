-- Clinic metadata, owner binding and suspension state are platform-owner controls.
-- No clinic-admin UI path updates the clinics row directly; staff manage their
-- patients and invitations through their scoped tables/RPCs.

BEGIN;

DROP POLICY IF EXISTS clinics_update_authorized ON public.clinics;
DROP POLICY IF EXISTS clinics_owner_update ON public.clinics;

CREATE POLICY clinics_owner_update
  ON public.clinics FOR UPDATE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner')
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

COMMIT;
