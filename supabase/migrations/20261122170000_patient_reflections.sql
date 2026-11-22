-- Patient reflections between sessions with explicit private/shared visibility.
BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id text NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL DEFAULT '',
  mood smallint,
  symptoms text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared')),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_reflections_content_length
    CHECK (length(content) <= 2000),
  CONSTRAINT patient_reflections_symptoms_length
    CHECK (length(symptoms) <= 1000),
  CONSTRAINT patient_reflections_mood_range
    CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  CONSTRAINT patient_reflections_not_empty
    CHECK (
      length(btrim(content)) > 0
      OR length(btrim(symptoms)) > 0
      OR mood IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS patient_reflections_patient_date_idx
  ON public.patient_reflections (clinic_id, patient_id, entry_date DESC, created_at DESC);

ALTER TABLE public.patient_reflections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.patient_reflections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.patient_reflections TO authenticated;
GRANT UPDATE (entry_date, content, mood, symptoms, visibility, updated_at)
  ON TABLE public.patient_reflections TO authenticated;

DROP POLICY IF EXISTS patient_reflections_select_visibility ON public.patient_reflections;
CREATE POLICY patient_reflections_select_visibility
  ON public.patient_reflections
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (
      (
        (SELECT private.caller_role()) = 'patient'
        AND patient_id = (SELECT auth.uid())
      )
      OR
      (
        (SELECT private.caller_role()) IN ('coach', 'admin')
        AND visibility = 'shared'
        AND (SELECT private.can_access_patient(patient_id))
      )
    )
  );

DROP POLICY IF EXISTS patient_reflections_insert_patient ON public.patient_reflections;
CREATE POLICY patient_reflections_insert_patient
  ON public.patient_reflections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND patient_id = (SELECT auth.uid())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND p.clinic_id = clinic_id
    )
  );

DROP POLICY IF EXISTS patient_reflections_update_patient ON public.patient_reflections;
CREATE POLICY patient_reflections_update_patient
  ON public.patient_reflections
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active(clinic_id))
  )
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND patient_id = (SELECT auth.uid())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS patient_reflections_delete_patient ON public.patient_reflections;
CREATE POLICY patient_reflections_delete_patient
  ON public.patient_reflections
  FOR DELETE
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

COMMENT ON TABLE public.patient_reflections IS
  'Patient-authored between-session journal entries. Private rows are visible only to the patient; shared rows may be read by assigned clinic staff. This is not a chat channel.';
COMMENT ON COLUMN public.patient_reflections.visibility IS
  'Patient-controlled sharing: private is patient-only; shared is visible to authorized clinic staff through RLS.';

COMMIT;
