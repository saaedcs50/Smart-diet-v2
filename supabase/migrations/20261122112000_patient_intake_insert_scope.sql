-- Restrict which intake fields patients may provide at INSERT time.
-- Creator, timestamps and review state are server-owned defaults only.
BEGIN;

REVOKE INSERT ON TABLE public.patient_intakes FROM authenticated;
GRANT INSERT (clinic_id, patient_id, answers, consent_version)
  ON TABLE public.patient_intakes TO authenticated;

DROP POLICY IF EXISTS patient_intakes_insert_patient ON public.patient_intakes;
CREATE POLICY patient_intakes_insert_patient
  ON public.patient_intakes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND patient_id = (SELECT auth.uid())
    AND submitted_by = (SELECT auth.uid())
    AND status = 'submitted'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND consent_version = 'patient-intake-v1-2026-11-22'
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND p.clinic_id = clinic_id
    )
  );

COMMIT;
