-- Non-destructive patient archive state for clinic staff.
BEGIN;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid
    REFERENCES public.profiles(id) ON DELETE RESTRICT;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='patients_archive_actor_pair_check'
      AND conrelid='public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_archive_actor_pair_check
      CHECK (
        (archived_at IS NULL AND archived_by IS NULL)
        OR (archived_at IS NOT NULL AND archived_by IS NOT NULL)
      );
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS patients_active_clinic_assignment_idx
  ON public.patients (clinic_id, invited_by, id)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.patients.archived_at IS
  'Non-destructive archive timestamp. Archived patients and their clinical records remain stored.';
COMMENT ON COLUMN public.patients.archived_by IS
  'Authenticated clinic staff profile that archived this patient.';

COMMIT;
