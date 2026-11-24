BEGIN;
GRANT UPDATE (status, approved_at, approved_by)
  ON TABLE public.patient_intake_drafts TO authenticated;
COMMIT;