-- Add persistent, clinic-scoped patient labels.
-- Access remains governed by the existing patients row-level security policies:
-- clinic admins and the assigned doctor may update, patients cannot.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_tags_valid;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_tags_valid
  CHECK (
    jsonb_typeof(tags) = 'array'
    AND jsonb_array_length(tags) <= 20
  );

COMMENT ON COLUMN public.patients.tags IS
  'Staff-managed operational labels; maximum 20 tags per patient. Visibility and writes follow patients RLS.';
