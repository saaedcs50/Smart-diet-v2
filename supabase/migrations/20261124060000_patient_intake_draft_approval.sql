-- Versioned clinician approval for patient intake drafts.
-- Approval is atomic: it publishes the reviewed draft to patients.plan and
-- marks the staff-only draft approved in the same transaction.
BEGIN;

ALTER TABLE public.patient_intake_drafts
  ADD COLUMN IF NOT EXISTS base_plan_updated_at text;

COMMENT ON COLUMN public.patient_intake_drafts.base_plan_updated_at IS
  'Timestamp of the active patient plan used as the draft base. Approval is blocked if the active plan has changed since draft creation.';

REVOKE ALL ON TABLE public.patient_intake_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.patient_intake_drafts TO authenticated;
GRANT INSERT (intake_id, draft_plan, base_plan_updated_at)
  ON TABLE public.patient_intake_drafts TO authenticated;
GRANT UPDATE (draft_plan, updated_at, updated_by)
  ON TABLE public.patient_intake_drafts TO authenticated;

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
    AND base_plan_updated_at IS NOT DISTINCT FROM (
      SELECT p.plan->>'updatedAt'
      FROM public.patient_intakes i
      JOIN public.patients p ON p.id = i.patient_id
      WHERE i.id = intake_id
    )
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

CREATE OR REPLACE FUNCTION public.approve_patient_intake_draft(p_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := private.caller_role();
  v_caller_clinic_id text := private.caller_clinic_id();
  v_patient_id uuid;
  v_intake_clinic_id text;
  v_intake_status text;
  v_draft_status text;
  v_draft_plan jsonb;
  v_base_plan_updated_at text;
  v_current_plan jsonb;
  v_current_plan_updated_at text;
  v_approved_plan jsonb;
  v_approved_at timestamptz;
  v_medications jsonb;
  v_medication jsonb;
  v_timings jsonb;
  v_expected_times integer;
  v_meals jsonb;
  v_checklist jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('coach', 'admin') THEN
    RAISE EXCEPTION 'CLINIC_STAFF_ONLY' USING ERRCODE = '42501';
  END IF;

  IF p_intake_id IS NULL THEN
    RAISE EXCEPTION 'INTAKE_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT
    d.status,
    d.draft_plan,
    d.base_plan_updated_at,
    i.patient_id,
    i.clinic_id,
    i.status,
    p.plan
  INTO
    v_draft_status,
    v_draft_plan,
    v_base_plan_updated_at,
    v_patient_id,
    v_intake_clinic_id,
    v_intake_status,
    v_current_plan
  FROM public.patient_intake_drafts d
  JOIN public.patient_intakes i ON i.id = d.intake_id
  JOIN public.patients p ON p.id = i.patient_id
  WHERE d.intake_id = p_intake_id
  FOR UPDATE OF d, p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_intake_clinic_id IS DISTINCT FROM v_caller_clinic_id
     OR NOT COALESCE(private.clinic_sub_active(v_intake_clinic_id), false)
     OR NOT COALESCE(private.can_access_patient(v_patient_id), false) THEN
    RAISE EXCEPTION 'PATIENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_intake_status <> 'reviewed' THEN
    RAISE EXCEPTION 'INTAKE_REVIEW_REQUIRED' USING ERRCODE = '55000';
  END IF;

  IF v_draft_status <> 'draft' THEN
    RAISE EXCEPTION 'DRAFT_ALREADY_APPROVED_OR_LOCKED' USING ERRCODE = '55000';
  END IF;

  v_current_plan_updated_at := CASE
    WHEN jsonb_typeof(v_current_plan) = 'object' THEN v_current_plan->>'updatedAt'
    ELSE NULL
  END;

  IF v_current_plan_updated_at IS DISTINCT FROM v_base_plan_updated_at THEN
    RAISE EXCEPTION 'ACTIVE_PLAN_CHANGED_REBUILD_DRAFT' USING ERRCODE = '40001';
  END IF;

  IF jsonb_typeof(v_draft_plan) <> 'object'
     OR NULLIF(btrim(v_draft_plan->>'clientName'), '') IS NULL
     OR NOT COALESCE(v_draft_plan->>'dailyWaterGoalMl' ~ '^[0-9]+$', false)
     OR (v_draft_plan->>'dailyWaterGoalMl')::integer NOT BETWEEN 250 AND 10000 THEN
    RAISE EXCEPTION 'DRAFT_PLAN_CORE_FIELDS_INVALID' USING ERRCODE = '22023';
  END IF;

  v_meals := COALESCE(v_draft_plan->'meals', '[]'::jsonb);
  v_checklist := COALESCE(v_draft_plan->'checklist', '[]'::jsonb);
  IF jsonb_typeof(v_meals) <> 'array' OR jsonb_typeof(v_checklist) <> 'array' THEN
    RAISE EXCEPTION 'DRAFT_PLAN_LISTS_INVALID' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_meals) AS meal(value)
    WHERE NULLIF(btrim(meal.value->>'name'), '') IS NULL
       OR NULLIF(btrim(meal.value->>'items'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'DRAFT_MEAL_CONTENT_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_medications := COALESCE(v_draft_plan #> '{medicationPlan,items}', '[]'::jsonb);
  IF jsonb_typeof(v_medications) <> 'array' THEN
    RAISE EXCEPTION 'DRAFT_MEDICATION_LIST_INVALID' USING ERRCODE = '22023';
  END IF;

  FOR v_medication IN
    SELECT item.value FROM jsonb_array_elements(v_medications) AS item(value)
  LOOP
    IF NULLIF(btrim(v_medication->>'name'), '') IS NULL
       OR NULLIF(btrim(v_medication->>'dose'), '') IS NULL THEN
      RAISE EXCEPTION 'MEDICATION_NAME_AND_DOSE_REQUIRED' USING ERRCODE = '22023';
    END IF;

    IF NOT COALESCE(v_medication->>'timesPerDay' ~ '^[1-6]$', false) THEN
      RAISE EXCEPTION 'MEDICATION_FREQUENCY_REQUIRED' USING ERRCODE = '22023';
    END IF;
    v_expected_times := (v_medication->>'timesPerDay')::integer;

    v_timings := COALESCE(v_medication->'timings', '[]'::jsonb);
    IF jsonb_typeof(v_timings) <> 'array'
       OR jsonb_array_length(v_timings) <> v_expected_times
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_timings) AS timing(value)
         WHERE NULLIF(btrim(timing.value->>'label'), '') IS NULL
            OR NULLIF(btrim(timing.value->>'slot'), '') IS NULL
       ) THEN
      RAISE EXCEPTION 'MEDICATION_TIMINGS_INCOMPLETE' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_approved_at := now();
  v_approved_plan := (v_draft_plan - 'adminPin')
    || jsonb_build_object(
      'updatedAt', v_approved_at::text,
      'updatedBy', v_user_id::text
    );

  UPDATE public.patients
  SET plan = v_approved_plan
  WHERE id = v_patient_id;

  UPDATE public.patient_intake_drafts
  SET
    status = 'approved',
    updated_at = v_approved_at,
    updated_by = v_user_id,
    approved_at = v_approved_at,
    approved_by = v_user_id
  WHERE intake_id = p_intake_id;

  RETURN jsonb_build_object(
    'plan', v_approved_plan,
    'approvedAt', v_approved_at,
    'approvedBy', v_user_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_patient_intake_draft(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_patient_intake_draft(uuid) TO authenticated;

COMMIT;