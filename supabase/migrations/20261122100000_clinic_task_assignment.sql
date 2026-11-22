-- Allow clinic admins to assign operational tasks to active clinic staff.
-- Coaches remain limited to tasks assigned to themselves.
BEGIN;

ALTER TABLE public.clinic_tasks
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

UPDATE public.clinic_tasks
SET created_by = user_id
WHERE created_by IS NULL;

ALTER TABLE public.clinic_tasks
  ALTER COLUMN created_by SET DEFAULT auth.uid(),
  ALTER COLUMN created_by SET NOT NULL;

-- Only the task status and timestamp are mutable. Owner, clinic and creator
-- cannot be reassigned by direct authenticated table updates.
REVOKE UPDATE ON TABLE public.clinic_tasks FROM authenticated;
GRANT UPDATE (status, updated_at) ON TABLE public.clinic_tasks TO authenticated;

DROP POLICY IF EXISTS clinic_tasks_select_own ON public.clinic_tasks;
DROP POLICY IF EXISTS clinic_tasks_insert_own ON public.clinic_tasks;
DROP POLICY IF EXISTS clinic_tasks_update_own ON public.clinic_tasks;

CREATE POLICY clinic_tasks_select_scoped
  ON public.clinic_tasks
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY clinic_tasks_insert_scoped
  ON public.clinic_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (
      (
        (SELECT private.caller_role()) = 'coach'
        AND user_id = (SELECT auth.uid())
      )
      OR
      (
        (SELECT private.caller_role()) = 'admin'
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = user_id
            AND p.clinic_id = (SELECT private.caller_clinic_id())
            AND p.disabled IS NOT TRUE
            AND p.role IN ('admin', 'coach')
        )
      )
    )
  );

CREATE POLICY clinic_tasks_update_scoped
  ON public.clinic_tasks
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.caller_role()) IN ('admin', 'coach')
    AND (SELECT private.clinic_sub_active(clinic_id))
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR user_id = (SELECT auth.uid())
    )
  );

COMMENT ON COLUMN public.clinic_tasks.user_id IS
  'Assigned staff member. Coaches see only rows assigned to their own profile; admins can view the clinic-wide task board.';
COMMENT ON COLUMN public.clinic_tasks.created_by IS
  'Authenticated creator; immutable through authenticated table grants.';

COMMIT;
