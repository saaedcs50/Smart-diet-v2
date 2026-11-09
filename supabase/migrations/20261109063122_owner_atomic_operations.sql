-- Smart Diet v2 — atomic owner operations
-- Only callable by an enabled platform owner. All operations are transactional.

BEGIN;

CREATE OR REPLACE FUNCTION public.owner_create_clinic_with_owner(
  p_name text,
  p_owner_name text,
  p_owner_email text,
  p_owner_phone text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinic_id text;
  v_name text := btrim(coalesce(p_name, ''));
  v_owner_name text := btrim(coalesce(p_owner_name, ''));
  v_email text := lower(btrim(coalesce(p_owner_email, '')));
  v_phone text := btrim(coalesce(p_owner_phone, ''));
  v_rows integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'owner'
      AND p.disabled IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Only an enabled platform owner may create clinics'
      USING ERRCODE = '42501';
  END IF;

  IF v_name = '' OR length(v_name) > 120
     OR v_owner_name = '' OR length(v_owner_name) > 120
     OR position('@' IN v_email) < 2
     OR length(v_email) > 254
     OR length(v_phone) > 40 THEN
    RAISE EXCEPTION 'Invalid clinic or owner details'
      USING ERRCODE = '22023';
  END IF;

  v_clinic_id := 'clinic-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.clinics (
    id, name, owner_uid, owner_name, owner_phone, status
  ) VALUES (
    v_clinic_id, v_name, '', v_owner_name, v_phone, 'active'
  );

  INSERT INTO public.clinic_subscriptions (
    clinic_id, plan, status, start_at, expires_at, grace_ends_at,
    payments, updated_at
  ) VALUES (
    v_clinic_id, 'monthly', 'expired', v_now, NULL, NULL,
    '[]'::jsonb, v_now
  );

  -- An email already associated with an invitation is never silently moved
  -- between clinics. Raising here rolls back the clinic and subscription too.
  INSERT INTO public.invitations (
    email, role, clinic_id, created_by, status
  ) VALUES (
    v_email, 'admin', v_clinic_id, auth.uid(), 'pending'
  )
  ON CONFLICT (email) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'An invitation already exists for this email'
      USING ERRCODE = '23505';
  END IF;

  RETURN v_clinic_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_review_clinic_payment(
  p_clinic_id text,
  p_action text,
  p_plan text DEFAULT NULL,
  p_payment_index integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payments jsonb;
  v_payment jsonb;
  v_now timestamptz := clock_timestamp();
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'owner'
      AND p.disabled IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Only an enabled platform owner may review payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('activate', 'reject') THEN
    RAISE EXCEPTION 'Unsupported payment action'
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'activate' AND p_plan NOT IN ('permanent', 'monthly', 'annual') THEN
    RAISE EXCEPTION 'Unsupported subscription plan'
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'reject'
     AND (p_payment_index IS NULL OR btrim(coalesce(p_note, '')) = '') THEN
    RAISE EXCEPTION 'A payment index and rejection note are required'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize competing approvals/rejections for the same clinic.
  SELECT coalesce(s.payments, '[]'::jsonb)
  INTO v_payments
  FROM public.clinic_subscriptions s
  WHERE s.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription exists for this clinic'
      USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(v_payments) <> 'array' THEN
    RAISE EXCEPTION 'Subscription payment history is malformed'
      USING ERRCODE = '22023';
  END IF;

  IF p_payment_index IS NOT NULL THEN
    IF p_payment_index < 0 OR p_payment_index >= jsonb_array_length(v_payments) THEN
      RAISE EXCEPTION 'Payment request does not exist'
        USING ERRCODE = '22023';
    END IF;

    v_payment := v_payments -> p_payment_index;
    IF jsonb_typeof(v_payment) <> 'object' THEN
      RAISE EXCEPTION 'Payment record is malformed'
        USING ERRCODE = '22023';
    END IF;

    IF nullif(v_payment ->> 'reviewedAt', '') IS NOT NULL THEN
      RAISE EXCEPTION 'Payment request has already been reviewed'
        USING ERRCODE = '23505';
    END IF;

    v_payment := v_payment || jsonb_build_object(
      'reviewedAt', v_now,
      'reviewedBy', auth.uid()
    );

    IF p_action = 'reject' THEN
      v_payment := v_payment || jsonb_build_object(
        'note', 'مرفوض: ' || btrim(p_note)
      );
    END IF;

    v_payments := jsonb_set(
      v_payments,
      ARRAY[p_payment_index::text],
      v_payment,
      false
    );
  END IF;

  IF p_action = 'activate' THEN
    UPDATE public.clinic_subscriptions
    SET plan = p_plan,
        status = 'active',
        start_at = v_now,
        expires_at = CASE p_plan
          WHEN 'permanent' THEN NULL
          WHEN 'monthly' THEN v_now + interval '1 month'
          WHEN 'annual' THEN v_now + interval '12 months'
        END,
        grace_ends_at = NULL,
        payments = v_payments,
        updated_at = v_now
    WHERE clinic_id = p_clinic_id;
  ELSE
    UPDATE public.clinic_subscriptions
    SET payments = v_payments,
        updated_at = v_now
    WHERE clinic_id = p_clinic_id;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Subscription review did not update exactly one row';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_create_clinic_with_owner(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_review_clinic_payment(text, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_create_clinic_with_owner(text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_clinic_payment(text, text, text, integer, text)
  TO authenticated;

COMMIT;
