-- Secure, consented patient intake submissions for the cloud patient portal.
BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id text NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  answers jsonb NOT NULL,
  consent_version varchar(80) NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'reviewed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT patient_intakes_answers_shape CHECK (
    jsonb_typeof(answers) = 'object'
    AND octet_length(answers::text) <= 32768
    AND length(btrim(coalesce(answers->>'clientName', ''))) BETWEEN 1 AND 100
    AND (answers->'conditions' IS NULL OR (
      jsonb_typeof(answers->'conditions') = 'array'
      AND jsonb_array_length(answers->'conditions') <= 20
    ))
    AND (answers->'allergies' IS NULL OR (
      jsonb_typeof(answers->'allergies') = 'array'
      AND jsonb_array_length(answers->'allergies') <= 30
    ))
  ),
  CONSTRAINT patient_intakes_review_state CHECK (
    (status = 'submitted' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR
    (status = 'reviewed' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS patient_intakes_patient_submitted_idx
  ON public.patient_intakes (clinic_id, patient_id, submitted_at DESC);

ALTER TABLE public.patient_intakes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.patient_intakes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.patient_intakes TO authenticated;
GRANT UPDATE (status, reviewed_at, reviewed_by)
  ON TABLE public.patient_intakes TO authenticated;

DROP POLICY IF EXISTS patient_intakes_select_authorized ON public.patient_intakes;
CREATE POLICY patient_intakes_select_authorized
  ON public.patient_intakes
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (SELECT private.caller_role()) IN ('patient', 'coach', 'admin')
    AND (SELECT private.can_access_patient(patient_id))
  );

DROP POLICY IF EXISTS patient_intakes_insert_patient ON public.patient_intakes;
CREATE POLICY patient_intakes_insert_patient
  ON public.patient_intakes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND patient_id = (SELECT auth.uid())
    AND submitted_by = (SELECT auth.uid())
    AND consent_version <> ''
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND p.clinic_id = clinic_id
    )
  );

DROP POLICY IF EXISTS patient_intakes_review_staff ON public.patient_intakes;
CREATE POLICY patient_intakes_review_staff
  ON public.patient_intakes
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND (SELECT private.can_access_patient(patient_id))
    AND status = 'submitted'
  )
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND (SELECT private.can_access_patient(patient_id))
    AND status = 'reviewed'
    AND reviewed_at IS NOT NULL
    AND reviewed_by = (SELECT auth.uid())
  );

COMMENT ON TABLE public.patient_intakes IS
  'Patient-submitted nutrition and health intake answers. Patient can insert and read own records; authorized clinic staff can read and mark submitted records reviewed. Answers are never auto-applied to the active plan.';
COMMENT ON COLUMN public.patient_intakes.answers IS
  'Consent-based, size-limited JSON intake snapshot. Treat all values as sensitive health data.';
COMMENT ON COLUMN public.patient_intakes.consent_version IS
  'Version of the explicit patient-to-clinic sharing notice accepted at submission.';

COMMIT;
