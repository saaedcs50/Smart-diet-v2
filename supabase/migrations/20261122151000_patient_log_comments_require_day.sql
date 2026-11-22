-- A staff comment must always reference a real daily journal entry.
BEGIN;

ALTER TABLE public.patient_log_comments
  ADD CONSTRAINT patient_log_comments_day_log_fkey
  FOREIGN KEY (patient_id, log_date)
  REFERENCES public.day_logs (patient_id, log_date)
  ON DELETE CASCADE;

COMMIT;
