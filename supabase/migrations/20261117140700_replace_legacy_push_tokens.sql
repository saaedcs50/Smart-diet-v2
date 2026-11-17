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
      AND endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
    )
);

CREATE INDEX IF NOT EXISTS push_subscriptions_patient_idx
  ON public.push_subscriptions(patient_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.push_subscriptions TO authenticated;

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
     OR p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' THEN
    RAISE EXCEPTION 'Unsupported or invalid push endpoint'
      USING ERRCODE = '22023';
  END IF;

  v_clinic_id := private.caller_clinic_id();
  IF v_clinic_id IS NULL OR NOT private.clinic_sub_active(v_clinic_id) THEN
    RAISE EXCEPTION 'Clinic subscription is not active'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, patient_id, updated_at)
  VALUES (p_endpoint, v_uid, now())
  ON CONFLICT (endpoint) DO UPDATE
    SET patient_id = EXCLUDED.patient_id,
        updated_at = now();
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
         AND v_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' THEN
        INSERT INTO public.push_subscriptions (endpoint, patient_id)
        VALUES (v_endpoint, v_row.patient_id)
        ON CONFLICT (endpoint) DO NOTHING;
      END IF;
    END LOOP;
    DROP TABLE public.fcm_tokens;
  END IF;
END;
$migration$;

COMMENT ON TABLE public.push_subscriptions IS
  'Browser Web Push endpoints only. No patient names, clinical content, or private browser keys are stored.';

COMMIT;
