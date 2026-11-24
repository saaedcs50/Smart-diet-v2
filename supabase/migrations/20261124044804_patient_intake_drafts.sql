-- Separate, clinic-scoped draft plans generated from patient intake submissions.
-- Draft rows are staff-only and cannot become active patient plans through this table.
BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_intake_drafts (
  intake_id uuid PRIMARY KEY
    REFERENCES public.patient_intakes(id) ON DELETE CASCADE,
  draft_plan jsonb NOT NULL,
  base_plan_updated_at text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved')),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT patient_intake_drafts_plan_shape CHECK (
    jsonb_typeof(draft_plan) = 'object'
    AND octet_length(draft_plan::text) <= 262144
  ),
  CONSTRAINT patient_intake_drafts_approval_state CHECK (
    (status = 'draft' AND approved_at IS NULL AND approved_by IS NULL)
    OR
    (status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

ALTER TABLE public.patient_intake_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.patient_intake_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.patient_intake_drafts TO authenticated;
GRANT INSERT (intake_id, draft_plan, base_plan_updated_at)
  ON TABLE public.patient_intake_drafts TO authenticated;
-- Until the explicit clinician-approval action is implemented, clients may
-- change only draft content and its audit fields. They cannot approve/delete.
GRANT UPDATE (draft_plan, updated_at, updated_by)
  ON TABLE public.patient_intake_drafts TO authenticated;

DROP POLICY IF EXISTS patient_intake_drafts_select_staff ON public.patient_intake_drafts;
CREATE POLICY patient_intake_drafts_select_staff
  ON public.patient_intake_drafts
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.caller_role()) IN ('coach', 'admin')
    AND EXISTS (
      SELECT 1
      FROM public.patient_intakes i
      WHERE i.id = intake_id
        AND i.clinic_id = (SELECT private.caller_clinic_id())
        AND (SELECT private.clinic_sub_active(i.clinic_id))
        AND (SELECT private.can_access_patient(i.patient_id))
    )
  );

DROP POLICY IF EXISTS patient_intake_drafts_insert_staff ON public.patient_intake_drafts;
CREATE POLICY patient_intake_drafts_insert_staff
  ON public.patient_intake_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'draft'
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
    AND approved_at IS NULL
    AND approved_by IS NULL
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND EXISTS (
      SELECT 1
      FROM public.patient_intakes i
      WHERE i.id = intake_id
        AND i.clinic_id = (SELECT private.caller_clinic_id())
        AND (SELECT private.clinic_sub_active(i.clinic_id))
        AND (SELECT private.can_access_patient(i.patient_id))
    )
  );

DROP POLICY IF EXISTS patient_intake_drafts_update_staff ON public.patient_intake_drafts;
CREATE POLICY patient_intake_drafts_update_staff
  ON public.patient_intake_drafts
  FOR UPDATE
  TO authenticated
  USING (
    status = 'draft'
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND EXISTS (
      SELECT 1
      FROM public.patient_intakes i
      WHERE i.id = intake_id
        AND i.clinic_id = (SELECT private.caller_clinic_id())
        AND (SELECT private.clinic_sub_active(i.clinic_id))
        AND (SELECT private.can_access_patient(i.patient_id))
    )
  )
  WITH CHECK (
    status = 'draft'
    AND updated_by = (SELECT auth.uid())
    AND approved_at IS NULL
    AND approved_by IS NULL
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND EXISTS (
      SELECT 1
      FROM public.patient_intakes i
      WHERE i.id = intake_id
        AND i.clinic_id = (SELECT private.caller_clinic_id())
        AND (SELECT private.clinic_sub_active(i.clinic_id))
        AND (SELECT private.can_access_patient(i.patient_id))
    )
  );

COMMENT ON TABLE public.patient_intake_drafts IS
  'Staff-only structured draft plan generated from a patient intake. It is separate from patients.plan and is not visible to patients until a separate clinician approval flow applies it.';
COMMENT ON COLUMN public.patient_intake_drafts.draft_plan IS
  'Unapproved PlanConfig JSON generated from patient-submitted answers and a clinic template. Never treated as the active patient plan.';
COMMENT ON COLUMN public.patient_intake_drafts.status IS
  'draft remains editable by authorized clinic staff; approved is reserved for the explicit clinician approval workflow.';

COMMIT;
