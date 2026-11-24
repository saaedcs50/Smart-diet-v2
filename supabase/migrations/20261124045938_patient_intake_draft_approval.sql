BEGIN;

ALTER TABLE public.patient_intake_drafts
  ADD COLUMN IF NOT EXISTS base_plan_updated_at text;

GRANT INSERT (intake_id, draft_plan, base_plan_updated_at)
  ON TABLE public.patient_intake_drafts TO authenticated;
GRANT UPDATE (status, approved_at, approved_by)
  ON TABLE public.patient_intake_drafts TO authenticated;
COMMIT;