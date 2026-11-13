-- Fix the JSONB key-count validation in the payment append trigger.
-- jsonb_object_keys() is portable across the supported Postgres versions.

BEGIN;

CREATE OR REPLACE FUNCTION private.guard_clinic_subscription_payment_append()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_uid uuid;
  v_old_length integer;
  v_request jsonb;
  v_request_id uuid;
  v_amount numeric;
  v_key_count integer;
  v_submitted_at timestamptz := clock_timestamp();
BEGIN
  v_role := private.caller_role();
  v_uid := auth.uid();

  IF v_role = 'owner' THEN
    RETURN NEW;
  END IF;

  IF v_role IS DISTINCT FROM 'admin' OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Only an enabled clinic admin may append a payment request'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role = 'admin'
      AND p.clinic_id = OLD.clinic_id AND p.disabled IS NOT TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = OLD.clinic_id AND c.status <> 'suspended'
  ) THEN
    RAISE EXCEPTION 'The clinic admin account is disabled or out of scope'
      USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - ARRAY['payments', 'updated_at']::text[])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['payments', 'updated_at']::text[]) THEN
    RAISE EXCEPTION 'Clinic admins may only append a payment request'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(OLD.payments) IS DISTINCT FROM 'array'
     OR jsonb_typeof(NEW.payments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Payment history must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  v_old_length := jsonb_array_length(OLD.payments);
  IF jsonb_array_length(NEW.payments) <> v_old_length + 1
     OR (NEW.payments - v_old_length) IS DISTINCT FROM OLD.payments THEN
    RAISE EXCEPTION 'A clinic admin may append exactly one payment record'
      USING ERRCODE = '42501';
  END IF;

  v_request := NEW.payments -> v_old_length;
  IF jsonb_typeof(v_request) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Payment request must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_key_count FROM jsonb_object_keys(v_request);
  IF v_key_count <> 10
     OR NOT (v_request ?& ARRAY[
       'requestId', 'method', 'amount', 'currency', 'reference',
       'submittedAt', 'submittedBy', 'reviewedAt', 'reviewedBy', 'note'
     ]::text[]) THEN
    RAISE EXCEPTION 'Payment request must contain exactly the approved fields'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_request -> 'requestId') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_request -> 'method') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_request -> 'amount') IS DISTINCT FROM 'number'
     OR jsonb_typeof(v_request -> 'currency') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_request -> 'reference') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_request -> 'submittedAt') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_request -> 'submittedBy') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_request -> 'note') IS DISTINCT FROM 'string'
     OR v_request -> 'reviewedAt' IS DISTINCT FROM 'null'::jsonb
     OR v_request -> 'reviewedBy' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Payment request field types or review state are invalid'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_request_id := (v_request ->> 'requestId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Payment request must include a valid requestId'
      USING ERRCODE = '22023';
  END;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(OLD.payments) AS item(value)
    WHERE item.value ->> 'requestId' = v_request_id::text
  ) THEN
    RAISE EXCEPTION 'Duplicate payment requestId'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(OLD.payments) AS item(value)
    WHERE item.value ->> 'reviewedAt' IS NULL
  ) THEN
    RAISE EXCEPTION 'A pending payment request already exists'
      USING ERRCODE = '23505';
  END IF;

  IF v_request ->> 'submittedBy' IS DISTINCT FROM v_uid::text THEN
    RAISE EXCEPTION 'Payment submitter must match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF v_request ->> 'method' NOT IN ('instapay', 'vodafone_cash')
     OR v_request ->> 'currency' IS DISTINCT FROM 'EGP'
     OR length(btrim(v_request ->> 'reference')) = 0
     OR length(btrim(v_request ->> 'reference')) > 160
     OR length(v_request ->> 'note') > 500 THEN
    RAISE EXCEPTION 'Payment request fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_amount := (v_request ->> 'amount')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Payment amount must be a valid number'
      USING ERRCODE = '22023';
  END;

  IF v_amount IS NULL OR v_amount <= 0
     OR v_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero and finite'
      USING ERRCODE = '22023';
  END IF;

  -- Overwrite untrusted client timestamps and submitter with database values.
  NEW.payments := jsonb_set(
    NEW.payments, ARRAY[v_old_length::text, 'submittedAt'],
    to_jsonb(v_submitted_at), false
  );
  NEW.payments := jsonb_set(
    NEW.payments, ARRAY[v_old_length::text, 'submittedBy'],
    to_jsonb(v_uid::text), false
  );
  NEW.updated_at := v_submitted_at;

  RETURN NEW;
END;
$function$;

COMMIT;
