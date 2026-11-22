-- Append-only, patient-visible staff notes attached to a daily journal entry.
BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_log_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id text NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  log_date date NOT NULL,
  content varchar(1200) NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_log_comments_content_not_blank
    CHECK (length(btrim(content)) BETWEEN 1 AND 1200)
);

CREATE INDEX IF NOT EXISTS patient_log_comments_patient_date_idx
  ON public.patient_log_comments (clinic_id, patient_id, log_date DESC, created_at ASC);

ALTER TABLE public.patient_log_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.patient_log_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.patient_log_comments TO authenticated;

DROP POLICY IF EXISTS patient_log_comments_select_authorized ON public.patient_log_comments;
CREATE POLICY patient_log_comments_select_authorized
  ON public.patient_log_comments
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (SELECT private.caller_role()) IN ('patient', 'coach', 'admin')
    AND (SELECT private.can_access_patient(patient_id))
  );

DROP POLICY IF EXISTS patient_log_comments_insert_staff ON public.patient_log_comments;
CREATE POLICY patient_log_comments_insert_staff
  ON public.patient_log_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND (SELECT private.can_access_patient(patient_id))
  );

COMMENT ON TABLE public.patient_log_comments IS
  'Append-only, patient-visible clinic staff notes attached to a daily journal date. This is not a chat or messaging channel.';
COMMENT ON COLUMN public.patient_log_comments.content IS
  'Plain-text feedback from clinic staff. Patients can read notes for their own patient record; only authorized staff may insert.';

COMMIT;
