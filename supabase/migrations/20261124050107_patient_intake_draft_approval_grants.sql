-- Grants required by the invoker-based clinician approval RPC.
-- Row-level security still determines which patient and draft rows a caller may change.
BEGIN;

GRANT UPDATE (plan)
  ON TABLE public.patients TO authenticated;

GRANT UPDATE (status, approved_at, approved_by)
  ON TABLE public.patient_intake_drafts TO authenticated;

COMMIT;
