-- Replace legacy serialized push tokens with one endpoint per browser subscription.
-- Existing Web Push endpoints are retained; private browser keys are not required
-- because this function sends empty-payload notifications only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint text PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_https
    CHECK (
      length(endpoint) BETWEEN 16 AND 2048
      AND endpoint ~ '^https://(updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
    )
);

CREATE INDEX IF NOT EXISTS push_subscriptions_patient_idx
  ON public.push_subscriptions(patient_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (patient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (patient_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.claim_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
    RAISE EXCEPTION 'Clinic subscription is not active'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, patient_id, updated_at)
  VALUES (p_endpoint, v_uid, now())
  ON CONFLICT (endpoint) DO UPDATE
    SET updated_at = now()
    WHERE public.push_subscriptions.patient_id = EXCLUDED.patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Push endpoint is already registered to another account'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_push_subscription(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text) TO authenticated;

-- Migrate valid browser-generated endpoints from the legacy serialized token table.
DO $migration$
DECLARE
  v_row record;
  v_subscription jsonb;
  v_endpoint text;
BEGIN
  IF to_regclass('public.fcm_tokens') IS NOT NULL THEN
    FOR v_row IN EXECUTE
      'SELECT ft.patient_id, legacy.token FROM public.fcm_tokens AS ft CROSS JOIN LATERAL unnest(ft.tokens) AS legacy(token)'
    LOOP
      BEGIN
        v_subscription := v_row.token::jsonb;
      EXCEPTION WHEN others THEN
        CONTINUE;
      END;
      v_endpoint := v_subscription ->> 'endpoint';
      IF v_endpoint IS NOT NULL
         AND length(v_endpoint) BETWEEN 16 AND 2048
         AND v_endpoint ~ '^https://(updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' THEN
        INSERT INTO public.push_subscriptions (endpoint, patient_id)
        VALUES (v_endpoint, v_row.patient_id)
        ON CONFLICT (endpoint) DO NOTHING;
      END IF;
    END LOOP;
    DROP TABLE public.fcm_tokens;
  END IF;
END;
$migration$;

-- Server-only access to signing keys stored in Supabase Vault.
CREATE OR REPLACE FUNCTION public.get_push_signing_config()
RETURNS TABLE (
  vapid_public_key text,
  vapid_private_key text,
  vapid_subject text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_diet_vapid_public_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_diet_vapid_private_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_diet_vapid_subject' LIMIT 1);
$function$;

REVOKE ALL ON FUNCTION public.get_push_signing_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_signing_config() TO service_role;

COMMENT ON FUNCTION public.get_push_signing_config() IS
  'Returns VAPID signing keys from Supabase Vault to service_role only.';

COMMENT ON TABLE public.push_subscriptions IS
  'Browser Web Push endpoints only. No patient names, clinical content, or private browser keys are stored.';

COMMIT;
