-- Allow the standards-based Chrome/Chromium Web Push endpoint.
-- This is Web Push authenticated with VAPID, not the retired legacy FCM API.
BEGIN;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_https;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_https
  CHECK (
    length(endpoint) BETWEEN 16 AND 2048
    AND (
      endpoint ~ '^https://(updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
      OR endpoint ~ '^https://fcm\.googleapis\.com/fcm/send/[^/?#]+$'
    )
  );

CREATE OR REPLACE FUNCTION public.claim_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic_id text;
BEGIN
  IF v_uid IS NULL OR private.caller_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only an authenticated patient can register a push endpoint'
      USING ERRCODE = '42501';
  END IF;

  IF p_endpoint IS NULL OR length(p_endpoint) NOT BETWEEN 16 AND 2048
     OR NOT (
       p_endpoint ~ '^https://(updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
       OR p_endpoint ~ '^https://fcm\.googleapis\.com/fcm/send/[^/?#]+$'
     ) THEN
    RAISE EXCEPTION 'Unsupported or invalid push endpoint'
      USING ERRCODE = '22023';
  END IF;

  v_clinic_id := private.caller_clinic_id();
  IF v_clinic_id IS NULL
     OR NOT private.clinic_sub_active(v_clinic_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.clinics c
       WHERE c.id = v_clinic_id AND c.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Clinic is not active'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, patient_id, updated_at)
  VALUES (p_endpoint, v_uid, now())
  ON CONFLICT (endpoint) DO NOTHING;

  -- A conflicting endpoint that belongs to another patient is hidden by RLS.
  -- Treat it as a failure instead of silently transferring its ownership.
  IF NOT EXISTS (
    SELECT 1
    FROM public.push_subscriptions
    WHERE endpoint = p_endpoint AND patient_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Push endpoint is already registered to another account'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_push_subscription(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text) TO authenticated;

COMMIT;
