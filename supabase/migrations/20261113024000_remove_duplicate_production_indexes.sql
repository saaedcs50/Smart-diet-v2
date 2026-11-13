-- Remove redundant non-constraint indexes when their canonical equivalent exists.
-- This migration is safe on Staging: it only drops an index when the canonical
-- index is present too. It never removes unique indexes backing constraints.

BEGIN;

DO $migration$
BEGIN
  IF to_regclass('public.adherence_scores_patient_date_idx') IS NOT NULL
     AND to_regclass('public.idx_adherence_scores_patient') IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.idx_adherence_scores_patient';
  END IF;

  IF to_regclass('public.day_logs_patient_id_log_date_key') IS NOT NULL
     AND to_regclass('public.day_logs_patient_id_log_date_uidx') IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.day_logs_patient_id_log_date_uidx';
  END IF;

  IF to_regclass('public.patients_clinic_id_idx') IS NOT NULL
     AND to_regclass('public.idx_patients_clinic') IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.idx_patients_clinic';
  END IF;

  IF to_regclass('public.patients_invited_by_idx') IS NOT NULL
     AND to_regclass('public.idx_patients_invited_by') IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.idx_patients_invited_by';
  END IF;
END;
$migration$;

COMMIT;
