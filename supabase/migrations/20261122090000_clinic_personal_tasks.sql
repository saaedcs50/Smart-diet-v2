-- Personal staff task list; delegation is intentionally not enabled in this slice.
BEGIN;

CREATE TABLE IF NOT EXISTS public.clinic_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id text NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title varchar(140) NOT NULL,
  due_on date,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_tasks_title_not_blank
    CHECK (length(btrim(title)) BETWEEN 1 AND 140)
);

CREATE INDEX IF NOT EXISTS clinic_tasks_personal_due_idx
  ON public.clinic_tasks (clinic_id, user_id, status, due_on, created_at DESC);

ALTER TABLE public.clinic_tasks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.clinic_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clinic_tasks TO authenticated;

DROP POLICY IF EXISTS clinic_tasks_select_own ON public.clinic_tasks;
CREATE POLICY clinic_tasks_select_own
  ON public.clinic_tasks
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS clinic_tasks_insert_own ON public.clinic_tasks;
CREATE POLICY clinic_tasks_insert_own
  ON public.clinic_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS clinic_tasks_update_own ON public.clinic_tasks;
CREATE POLICY clinic_tasks_update_own
  ON public.clinic_tasks
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

COMMENT ON TABLE public.clinic_tasks IS
  'Personal, non-clinical task reminders for clinic admins and coaches. Rows are visible only to their owner; delegation is not enabled.';
COMMENT ON COLUMN public.clinic_tasks.title IS
  'Short operational task title. Do not store patient health details in this field.';

COMMIT;
