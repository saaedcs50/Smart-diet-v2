-- Reconcile legacy policies that existed only in the manually-provisioned
-- Staging catalog. Replace PUBLIC policies with authenticated-only policies
-- and consolidate overlapping clinic/subscription policies.

BEGIN;

-- CLINICS: one read policy and one update policy, with owner writes separate.
DROP POLICY IF EXISTS clinics_owner_all ON public.clinics;
DROP POLICY IF EXISTS clinics_member_read ON public.clinics;
DROP POLICY IF EXISTS clinics_admin_update ON public.clinics;

CREATE POLICY clinics_select_authorized
  ON public.clinics FOR SELECT TO authenticated
  USING (
    id = (SELECT private.caller_clinic_id())
    OR (SELECT private.caller_role()) = 'owner'
  );

CREATE POLICY clinics_owner_insert
  ON public.clinics FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY clinics_update_authorized
  ON public.clinics FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND id = (SELECT private.caller_clinic_id())
    )
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND id = (SELECT private.caller_clinic_id())
    )
  );

CREATE POLICY clinics_owner_delete
  ON public.clinics FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');

-- CLINIC SUBSCRIPTIONS: staff may read their clinic's subscription; only the
-- platform owner may insert, update or delete subscription records.
DROP POLICY IF EXISTS subs_owner_all ON public.clinic_subscriptions;
DROP POLICY IF EXISTS subs_staff_read ON public.clinic_subscriptions;

CREATE POLICY subscriptions_select_authorized
  ON public.clinic_subscriptions FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) IN ('coach', 'admin')
      AND clinic_id = (SELECT private.caller_clinic_id())
    )
  );

CREATE POLICY subscriptions_owner_insert
  ON public.clinic_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY subscriptions_owner_update
  ON public.clinic_subscriptions FOR UPDATE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner')
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY subscriptions_owner_delete
  ON public.clinic_subscriptions FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');

-- DAY LOGS: preserve the shared access helper, but do not attach the policy
-- to PUBLIC. Both row visibility and writes use the same patient scope.
DROP POLICY IF EXISTS daylogs_access ON public.day_logs;
CREATE POLICY daylogs_access
  ON public.day_logs FOR ALL TO authenticated
  USING ((SELECT private.can_access_patient(patient_id)))
  WITH CHECK ((SELECT private.can_access_patient(patient_id)));

COMMIT;
