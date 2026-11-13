-- Patient-owned auxiliary records must also be unavailable after account disablement.
-- The central caller_role() helper returns NULL for disabled profiles.

BEGIN;

DROP POLICY IF EXISTS fcm_tokens_patient_manage_own ON public.fcm_tokens;
CREATE POLICY fcm_tokens_patient_manage_own
  ON public.fcm_tokens FOR ALL TO authenticated
  USING (
    patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
  )
  WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
  );

DROP POLICY IF EXISTS consents_patient_insert_own ON public.consents;
CREATE POLICY consents_patient_insert_own
  ON public.consents FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND granted_by = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
  );

DROP POLICY IF EXISTS consents_patient_read_own ON public.consents;
CREATE POLICY consents_patient_read_own
  ON public.consents FOR SELECT TO authenticated
  USING (
    patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
  );

DROP POLICY IF EXISTS consents_patient_update_own ON public.consents;
CREATE POLICY consents_patient_update_own
  ON public.consents FOR UPDATE TO authenticated
  USING (
    patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
  )
  WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND granted_by = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
  );

COMMIT;
