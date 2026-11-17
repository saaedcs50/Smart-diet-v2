-- Harden push endpoint registration without exposing an authenticated SECURITY DEFINER RPC.
BEGIN;

GRANT INSERT ON TABLE public.push_subscriptions TO authenticated;

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND (SELECT private.caller_role()) = 'patient'
    AND (SELECT private.clinic_sub_active((SELECT private.caller_clinic_id())))
    AND EXISTS (
      SELECT 1
      FROM public.clinics c
      WHERE c.id = (SELECT private.caller_clinic_id())
        AND c.status = 'active'
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
     OR p_endpoint !~ '^https://(updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' THEN
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
