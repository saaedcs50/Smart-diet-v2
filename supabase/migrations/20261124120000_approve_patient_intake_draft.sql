-- Explicit, atomic clinician approval of an intake-generated plan draft.
-- The active patient plan is changed only through this function after the
-- clinician has reviewed the source intake and the staff-only draft.
BEGIN;

CREATE OR REPLACE FUNCTION public.approve_patient_intake_draft(p_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_intake public.patient_intakes%ROWTYPE;
  v_draft public.patient_intake_drafts%ROWTYPE;
  v_patient_id uuid;
  v_plan jsonb;
  v_now timestamptz;
  v_updated_at text;
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
  IF v_role NOT IN ('coach', 'admin') THEN
    RAISE EXCEPTION 'اعتماد الخطة متاح للطبيب المعيّن أو مدير العيادة فقط.'
      USING ERRCODE = '42501';
  END IF;

  SELECT i.*
    INTO v_intake
    FROM public.patient_intakes AS i
   WHERE i.id = p_intake_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاستبيان غير موجود أو لا يمكن الوصول إليه.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_intake.clinic_id IS DISTINCT FROM private.caller_clinic_id()
     OR NOT private.clinic_sub_active(v_intake.clinic_id)
     OR NOT private.can_access_patient(v_intake.patient_id) THEN
    RAISE EXCEPTION 'لا تملك صلاحية اعتماد خطة هذا المريض داخل العيادة.'
      USING ERRCODE = '42501';
  END IF;

  IF v_intake.status <> 'reviewed' THEN
    RAISE EXCEPTION 'راجع استبيان المريض وسجّل اكتمال مراجعته قبل اعتماد الخطة.'
      USING ERRCODE = '55000';
  END IF;

  SELECT p.id
    INTO v_patient_id
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
   WHERE d.intake_id = p_intake_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أنشئ مسودة الخطة أولًا قبل اعتمادها.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_draft.status <> 'draft' THEN
    RAISE EXCEPTION 'هذه المسودة سبق اعتمادها ولا يمكن اعتمادها مرة أخرى.'
      USING ERRCODE = '55000';
  END IF;

  v_plan := v_draft.draft_plan - 'adminPin';

  IF jsonb_typeof(v_plan) <> 'object'
     OR octet_length(v_plan::text) > 262144
     OR length(btrim(coalesce(v_plan->>'clientName', ''))) NOT BETWEEN 1 AND 100
     OR coalesce(jsonb_typeof(v_plan->'meals'), '') <> 'array'
     OR coalesce(jsonb_typeof(v_plan->'checklist'), '') <> 'array'
     OR jsonb_array_length(v_plan->'meals') > 40
     OR jsonb_array_length(v_plan->'checklist') > 60 THEN
    RAISE EXCEPTION 'بيانات المسودة غير مكتملة أو تتجاوز الحدود المسموحة. راجعها قبل الاعتماد.'
      USING ERRCODE = '23514';
  END IF;

  v_now := clock_timestamp();
  v_updated_at := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_plan := v_plan || jsonb_build_object(
    'updatedAt', v_updated_at,
    'updatedBy', v_user::text
  );

  UPDATE public.patients
     SET plan = v_plan
   WHERE id = v_patient_id
     AND clinic_id = v_intake.clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذّر تحديث خطة ملف المريض.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.patient_intake_drafts
     SET status = 'approved',
         approved_at = v_now,
         approved_by = v_user,
         updated_at = v_now,
         updated_by = v_user
   WHERE intake_id = p_intake_id
     AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تغيرت حالة المسودة أثناء الاعتماد؛ لم يتم اعتماد الخطة.'
      USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'intake_id', p_intake_id,
    'patient_id', v_patient_id,
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

REVOKE ALL ON FUNCTION public.approve_patient_intake_draft(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_patient_intake_draft(uuid) TO authenticated;

COMMENT ON FUNCTION public.approve_patient_intake_draft(uuid) IS
  'Atomically applies a reviewed staff-only intake draft to the patient cloud plan, strips legacy adminPin, and records the approving clinic clinician. The patient sees it only through the active plan after successful approval.';

COMMIT;