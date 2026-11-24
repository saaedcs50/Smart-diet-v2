-- Versioned, atomic clinician approval of patient intake drafts.
-- This function deliberately runs as SECURITY INVOKER so patient and draft RLS
-- policies remain in force. Active plans cannot be overwritten from stale drafts.
BEGIN;

ALTER TABLE public.patient_intake_drafts
  ADD COLUMN IF NOT EXISTS base_plan_updated_at text;

COMMENT ON COLUMN public.patient_intake_drafts.base_plan_updated_at IS
  'Timestamp of the active patient plan used as the draft base. Approval is blocked if the active plan has changed since draft creation.';

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
      FROM public.patient_intakes AS i
      JOIN public.patients AS p ON p.id = i.patient_id
      WHERE i.id = intake_id
    )
    AND (SELECT private.caller_role()) IN ('coach', 'admin')
    AND EXISTS (
      SELECT 1
      FROM public.patient_intakes AS i
      WHERE i.id = intake_id
        AND i.clinic_id = (SELECT private.caller_clinic_id())
        AND (SELECT private.clinic_sub_active(i.clinic_id))
        AND (SELECT private.can_access_patient(i.patient_id))
    )
  );

CREATE OR REPLACE FUNCTION public.approve_patient_intake_draft(p_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_intake public.patient_intakes%ROWTYPE;
  v_draft public.patient_intake_drafts%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_plan jsonb;
  v_current_plan_updated_at text;
  v_now timestamptz;
  v_updated_at text;
  v_meals jsonb;
  v_checklist jsonb;
  v_medications jsonb;
  v_medication jsonb;
  v_timings jsonb;
  v_expected_times integer;
  v_slot text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولًا.'
      USING ERRCODE = '42501';
  END IF;

  IF p_intake_id IS NULL THEN
    RAISE EXCEPTION 'معرّف الاستبيان غير صالح.'
      USING ERRCODE = '22023';
  END IF;

  v_role := private.caller_role();
  IF v_role IS NULL OR v_role NOT IN ('coach', 'admin') THEN
    RAISE EXCEPTION 'اعتماد الخطة متاح للطبيب المعيّن أو مدير العيادة فقط.'
      USING ERRCODE = '42501';
  END IF;

  SELECT i.*
    INTO v_intake
    FROM public.patient_intakes AS i
   WHERE i.id = p_intake_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاستبيان غير موجود أو لا يمكن الوصول إليه.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_intake.clinic_id IS DISTINCT FROM private.caller_clinic_id()
     OR private.clinic_sub_active(v_intake.clinic_id) IS NOT TRUE
     OR private.can_access_patient(v_intake.patient_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'لا تملك صلاحية اعتماد خطة هذا المريض داخل العيادة.'
      USING ERRCODE = '42501';
  END IF;

  IF v_intake.status <> 'reviewed' THEN
    RAISE EXCEPTION 'راجع استبيان المريض وسجّل اكتمال مراجعته قبل اعتماد الخطة.'
      USING ERRCODE = '55000';
  END IF;

  -- Lock the patient row first. Concurrent approvals serialize here; the
  -- conditional draft transition below prevents a second approval.
  SELECT p.*
    INTO v_patient
    FROM public.patients AS p
   WHERE p.id = v_intake.patient_id
     AND p.clinic_id = v_intake.clinic_id
     AND p.archived_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ملف المريض غير موجود أو مؤرشف.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT d.*
    INTO v_draft
    FROM public.patient_intake_drafts AS d
   WHERE d.intake_id = p_intake_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أنشئ مسودة الخطة أولًا قبل اعتمادها.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_draft.status <> 'draft' THEN
    RAISE EXCEPTION 'هذه المسودة سبق اعتمادها ولا يمكن اعتمادها مرة أخرى.'
      USING ERRCODE = '55000';
  END IF;

  v_current_plan_updated_at := CASE
    WHEN jsonb_typeof(v_patient.plan) = 'object' THEN v_patient.plan->>'updatedAt'
    ELSE NULL
  END;

  IF v_current_plan_updated_at IS DISTINCT FROM v_draft.base_plan_updated_at THEN
    RAISE EXCEPTION 'ACTIVE_PLAN_CHANGED_REBUILD_DRAFT: تغيرت الخطة السارية بعد إنشاء المسودة.'
      USING ERRCODE = '40001';
  END IF;

  v_plan := v_draft.draft_plan - 'adminPin';

  IF jsonb_typeof(v_plan) <> 'object'
     OR octet_length(v_plan::text) > 262144
     OR length(btrim(coalesce(v_plan->>'clientName', ''))) NOT BETWEEN 1 AND 100
     OR NOT coalesce(v_plan->>'dailyWaterGoalMl' ~ '^[0-9]+$', false)
     OR (v_plan->>'dailyWaterGoalMl')::integer NOT BETWEEN 250 AND 10000 THEN
    RAISE EXCEPTION 'بيانات المسودة الأساسية أو هدف الماء غير صالح.'
      USING ERRCODE = '23514';
  END IF;

  v_meals := v_plan->'meals';
  v_checklist := v_plan->'checklist';
  IF coalesce(jsonb_typeof(v_meals), '') <> 'array'
     OR coalesce(jsonb_typeof(v_checklist), '') <> 'array'
     OR jsonb_array_length(v_meals) > 40
     OR jsonb_array_length(v_checklist) > 60 THEN
    RAISE EXCEPTION 'قائمة الوجبات أو المتابعة غير صالحة أو تتجاوز الحد المسموح.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_meals) AS meal(value)
     WHERE jsonb_typeof(meal.value) <> 'object'
        OR length(btrim(coalesce(meal.value->>'name', ''))) NOT BETWEEN 1 AND 100
        OR length(btrim(coalesce(meal.value->>'items', ''))) NOT BETWEEN 1 AND 2500
  ) THEN
    RAISE EXCEPTION 'أكمل اسم ومكونات كل وجبة قبل الاعتماد.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_checklist) AS item(value)
     WHERE jsonb_typeof(item.value) <> 'object'
        OR length(btrim(coalesce(item.value->>'label', ''))) NOT BETWEEN 1 AND 160
  ) THEN
    RAISE EXCEPTION 'راجع بنود المتابعة قبل الاعتماد.'
      USING ERRCODE = '23514';
  END IF;

  v_medications := coalesce(v_plan #> '{medicationPlan,items}', '[]'::jsonb);
  IF jsonb_typeof(v_medications) <> 'array'
     OR jsonb_array_length(v_medications) > 40 THEN
    RAISE EXCEPTION 'قائمة الأدوية غير صالحة.'
      USING ERRCODE = '23514';
  END IF;

  FOR v_medication IN
    SELECT item.value
      FROM jsonb_array_elements(v_medications) AS item(value)
  LOOP
    IF jsonb_typeof(v_medication) <> 'object'
       OR length(btrim(coalesce(v_medication->>'name', ''))) NOT BETWEEN 1 AND 120
       OR length(btrim(coalesce(v_medication->>'dose', ''))) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'أكمل اسم كل دواء والجرعة كما وردت في الوصفة.'
        USING ERRCODE = '23514';
    END IF;

    IF NOT coalesce(v_medication->>'timesPerDay' ~ '^[1-6]$', false) THEN
      RAISE EXCEPTION 'MEDICATION_FREQUENCY_REQUIRED: أدخل عدد مرات التناول اليومي من الوصفة.'
        USING ERRCODE = '23514';
    END IF;
    v_expected_times := (v_medication->>'timesPerDay')::integer;

    v_timings := coalesce(v_medication->'timings', '[]'::jsonb);
    IF jsonb_typeof(v_timings) <> 'array'
       OR jsonb_array_length(v_timings) <> v_expected_times
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(v_timings) AS timing(value)
          WHERE jsonb_typeof(timing.value) <> 'object'
             OR length(btrim(coalesce(timing.value->>'label', ''))) NOT BETWEEN 1 AND 80
             OR length(btrim(coalesce(timing.value->>'slot', ''))) NOT BETWEEN 1 AND 40
       ) THEN
      RAISE EXCEPTION 'MEDICATION_TIMINGS_INCOMPLETE: أكمل جميع مواعيد الجرعات من الوصفة.'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_timings) AS timing(value)
       WHERE timing.value->>'slot' NOT IN (
         'before_breakfast', 'with_breakfast', 'after_breakfast',
         'before_lunch', 'with_lunch', 'after_lunch',
         'before_dinner', 'with_dinner', 'after_dinner',
         'before_sleep', 'morning', 'evening', 'prn'
       )
    ) THEN
      RAISE EXCEPTION 'MEDICATION_TIMING_SLOT_INVALID: اختر مواعيد الجرعات من القائمة.'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  v_now := clock_timestamp();
  v_updated_at := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_plan := v_plan || jsonb_build_object(
    'updatedAt', v_updated_at,
    'updatedBy', v_user::text
  );

  UPDATE public.patients
     SET plan = v_plan
   WHERE id = v_patient.id
     AND clinic_id = v_intake.clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذّر تحديث خطة ملف المريض.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.patient_intake_drafts
     SET draft_plan = v_plan,
         status = 'approved',
         approved_at = v_now,
         approved_by = v_user,
         updated_at = v_now,
         updated_by = v_user
   WHERE intake_id = p_intake_id
     AND status = 'draft'
     AND base_plan_updated_at IS NOT DISTINCT FROM v_draft.base_plan_updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تغيرت حالة المسودة أثناء الاعتماد؛ لم يتم اعتماد الخطة.'
      USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'intake_id', p_intake_id,
    'patient_id', v_patient.id,
    'draft_plan', v_plan,
    'status', 'approved',
    'created_by', v_draft.created_by,
    'created_at', v_draft.created_at,
    'updated_by', v_user,
    'updated_at', v_now,
    'approved_by', v_user,
    'approved_at', v_now
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_patient_intake_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_patient_intake_draft(uuid) TO authenticated;

COMMENT ON FUNCTION public.approve_patient_intake_draft(uuid) IS
  'Atomically applies a reviewed staff-only intake draft after checking the base plan version. It runs as invoker so patient and draft row-level policies remain enforced.';

COMMIT;