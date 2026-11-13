-- Expose only the subscription state needed by the application gate.
-- Patient accounts must not read payment references or the full payments JSONB.

BEGIN;

CREATE OR REPLACE FUNCTION private.get_clinic_subscription_gate(
  p_clinic_id text
)
RETURNS TABLE (
  plan text,
  status text,
  start_at timestamptz,
  expires_at timestamptz,
  grace_ends_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_clinic_id text;
  v_disabled boolean;
BEGIN
  IF v_uid IS NULL OR p_clinic_id IS NULL OR length(p_clinic_id) = 0 THEN
    RETURN;
  END IF;

  SELECT p.role, p.clinic_id, p.disabled
    INTO v_role, v_clinic_id, v_disabled
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND OR v_disabled IS TRUE
     OR v_role NOT IN ('admin', 'coach', 'patient')
     OR v_clinic_id IS DISTINCT FROM p_clinic_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.plan, s.status, s.start_at, s.expires_at, s.grace_ends_at, s.updated_at
  FROM public.clinic_subscriptions s
  JOIN public.clinics c ON c.id = s.clinic_id
  WHERE s.clinic_id = p_clinic_id
    AND c.status <> 'suspended'
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION private.get_clinic_subscription_gate(text)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_clinic_subscription_gate(text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_clinic_subscription_gate(
  p_clinic_id text
)
RETURNS TABLE (
  plan text,
  status text,
  start_at timestamptz,
  expires_at timestamptz,
  grace_ends_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.get_clinic_subscription_gate(p_clinic_id);
$function$;

REVOKE ALL ON FUNCTION public.get_clinic_subscription_gate(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_subscription_gate(text)
  TO authenticated;

COMMIT;
