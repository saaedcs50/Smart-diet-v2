-- ============================================================================
-- Smart Diet Platform — canonical Production schema baseline
-- Captured from live Production catalogs on 2026-11-17.
-- Application-owned objects only; no patient or clinic data is included.
--
-- PREREQUISITES:
--   * Run only in a clean Supabase project/database; never replay over an
--     existing database and never run this file against Production.
--   * Supabase-managed auth.users, roles (anon/authenticated/service_role),
--     the extensions schema, Vault schema/table, and supabase_realtime
--     publication must already exist.
--   * Configure the three Vault secrets used by get_push_signing_config()
--     separately. This baseline contains no secret material or row data.
--   * Staging-only appointments are intentionally excluded from Production.
-- ============================================================================

BEGIN;
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
SET search_path = public, extensions, vault, pg_catalog;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- Supabase Vault must be provisioned by the target Supabase project.
-- The extension and its managed vault schema are not recreated here.

-- Sequences
CREATE SEQUENCE public.adherence_scores_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.consents_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.day_logs_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

-- Tables
CREATE TABLE public.adherence_configs (\n  patient_id uuid NOT NULL,
  axes jsonb NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.adherence_scores (\n  id bigint NOT NULL DEFAULT nextval('adherence_scores_id_seq'::regclass),
  patient_id uuid NOT NULL,
  score_date date NOT NULL,
  scores jsonb NOT NULL,
  overall numeric NOT NULL,
  entered_by uuid NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.clinic_subscriptions (\n  clinic_id text NOT NULL,
  plan text NOT NULL,
  status text NOT NULL,
  start_at timestamp with time zone,
  expires_at timestamp with time zone,
  grace_ends_at timestamp with time zone,
  payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.clinics (\n  id text NOT NULL,
  name text NOT NULL,
  owner_uid text NOT NULL DEFAULT ''::text,
  owner_name text,
  owner_phone text,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.consents (\n  id bigint NOT NULL DEFAULT nextval('consents_id_seq'::regclass),
  patient_id uuid NOT NULL,
  purpose text NOT NULL,
  consent jsonb NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.day_logs (\n  id bigint NOT NULL DEFAULT nextval('day_logs_id_seq'::regclass),
  patient_id uuid NOT NULL,
  log_date date NOT NULL,
  log jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.invitations (\n  email text NOT NULL,
  role text NOT NULL,
  clinic_id text NOT NULL,
  created_by uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.patients (\n  id uuid NOT NULL,
  clinic_id text NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb,
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb\n);

CREATE TABLE public.platform_config (\n  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.profiles (\n  id uuid NOT NULL,
  role text NOT NULL,
  clinic_id text NOT NULL,
  email text,
  display_name text,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()\n);

CREATE TABLE public.push_subscriptions (\n  endpoint text NOT NULL,
  patient_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()\n);

-- Constraints
ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_axes_array CHECK (jsonb_typeof(axes) = 'array'::text);
ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_pkey PRIMARY KEY (patient_id);
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_overall_range CHECK (overall >= 0::numeric AND overall <= 100::numeric);
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_pkey PRIMARY KEY (id);
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_scores_array CHECK (jsonb_typeof(scores) = 'array'::text);
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_pkey PRIMARY KEY (clinic_id);
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_plan_check CHECK (plan = ANY (ARRAY['permanent'::text, 'monthly'::text, 'annual'::text]));
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'grace'::text, 'expired'::text]));
ALTER TABLE public.clinics ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);
ALTER TABLE public.clinics ADD CONSTRAINT clinics_status_check CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text]));
ALTER TABLE public.consents ADD CONSTRAINT consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.consents ADD CONSTRAINT consents_patient_id_purpose_key UNIQUE (patient_id, purpose);
ALTER TABLE public.consents ADD CONSTRAINT consents_pkey PRIMARY KEY (id);
ALTER TABLE public.day_logs ADD CONSTRAINT day_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.day_logs ADD CONSTRAINT day_logs_patient_id_log_date_key UNIQUE (patient_id, log_date);
ALTER TABLE public.day_logs ADD CONSTRAINT day_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_pkey PRIMARY KEY (email);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK (role = ANY (ARRAY['patient'::text, 'coach'::text, 'admin'::text]));
ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'consumed'::text]));
ALTER TABLE public.patients ADD CONSTRAINT patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE public.patients ADD CONSTRAINT patients_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.patients ADD CONSTRAINT patients_pkey PRIMARY KEY (id);
ALTER TABLE public.patients ADD CONSTRAINT patients_tags_valid CHECK (jsonb_typeof(tags) = 'array'::text AND jsonb_array_length(tags) <= 20);
ALTER TABLE public.platform_config ADD CONSTRAINT platform_config_pkey PRIMARY KEY (key);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['patient'::text, 'coach'::text, 'admin'::text, 'owner'::text]));
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_https CHECK (length(endpoint) >= 16 AND length(endpoint) <= 2048 AND endpoint ~ '^https://(updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'::text);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (endpoint);

-- Sequence ownership
ALTER SEQUENCE public.adherence_scores_id_seq OWNED BY public.adherence_scores.id;
ALTER SEQUENCE public.consents_id_seq OWNED BY public.consents.id;
ALTER SEQUENCE public.day_logs_id_seq OWNED BY public.day_logs.id;

-- Non-constraint indexes
CREATE INDEX adherence_configs_updated_by_idx ON public.adherence_configs USING btree (updated_by);
CREATE INDEX adherence_scores_entered_by_idx ON public.adherence_scores USING btree (entered_by);
CREATE INDEX adherence_scores_patient_date_idx ON public.adherence_scores USING btree (patient_id, score_date DESC);
CREATE INDEX consents_granted_by_idx ON public.consents USING btree (granted_by);
CREATE INDEX idx_consents_patient ON public.consents USING btree (patient_id);
CREATE INDEX idx_day_logs_patient ON public.day_logs USING btree (patient_id);
CREATE INDEX invitations_clinic_id_idx ON public.invitations USING btree (clinic_id);
CREATE INDEX patients_clinic_id_idx ON public.patients USING btree (clinic_id);
CREATE INDEX patients_invited_by_idx ON public.patients USING btree (invited_by);
CREATE INDEX push_subscriptions_patient_idx ON public.push_subscriptions USING btree (patient_id);

-- Private helper routines
CREATE OR REPLACE FUNCTION private.caller_clinic_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$


CREATE OR REPLACE FUNCTION private.caller_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$


CREATE OR REPLACE FUNCTION private.can_access_patient(pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT CASE
 WHEN private.caller_role() = 'owner' THEN TRUE
 WHEN private.caller_role() = 'admin' THEN EXISTS (
   SELECT 1 FROM public.patients p
   WHERE p.id = pid AND p.clinic_id = private.caller_clinic_id()
     AND private.clinic_sub_active(p.clinic_id))
 WHEN private.caller_role() = 'coach' THEN EXISTS (
   SELECT 1 FROM public.patients p
   WHERE p.id = pid AND p.clinic_id = private.caller_clinic_id()
     AND p.invited_by = auth.uid() AND private.clinic_sub_active(p.clinic_id))
 ELSE pid = auth.uid() AND private.clinic_sub_active(private.caller_clinic_id())
END;
$function$


CREATE OR REPLACE FUNCTION private.can_claim_invitation(p_role text, p_clinic_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.invitations i
      WHERE i.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
        AND i.status = 'pending'
        AND i.role = p_role
        AND i.clinic_id = p_clinic_id
    );
$function$


CREATE OR REPLACE FUNCTION private.clinic_sub_active(cid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.clinics c
      WHERE c.id = cid
        AND c.status <> 'suspended'
    )
    AND EXISTS (
      SELECT 1
      FROM public.clinic_subscriptions s
      WHERE s.clinic_id = cid
        AND s.status IN ('active', 'grace')
    );
$function$


CREATE OR REPLACE FUNCTION private.enforce_invitation_consume()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_email text;
  v_actor_role text;
  v_actor_clinic text;
  v_actor_uid uuid;
  v_staff_allowed boolean := false;
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Invitation identity and authorization fields are immutable';
  END IF;

  v_actor_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  IF v_actor_email <> '' AND v_actor_email = lower(OLD.email) THEN
    IF OLD.status = 'pending' AND NEW.status = 'consumed' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invitee may only consume a pending invitation';
  END IF;

  v_actor_role := private.caller_role();
  v_actor_clinic := private.caller_clinic_id();
  v_actor_uid := auth.uid();

  IF v_actor_role = 'owner' THEN
    v_staff_allowed := true;
  ELSIF v_actor_role = 'admin'
        AND v_actor_clinic = OLD.clinic_id
        AND OLD.role IN ('coach', 'patient') THEN
    v_staff_allowed := true;
  ELSIF v_actor_role = 'coach'
        AND v_actor_clinic = OLD.clinic_id
        AND OLD.role = 'patient'
        AND OLD.created_by = v_actor_uid THEN
    v_staff_allowed := true;
  END IF;

  IF v_staff_allowed
     AND (
       OLD.status = NEW.status
       OR (OLD.status = 'consumed' AND NEW.status = 'pending')
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid or unauthorized invitation status transition';
END;
$function$


CREATE OR REPLACE FUNCTION private.get_clinic_subscription_gate(p_clinic_id text)
 RETURNS TABLE(plan text, status text, start_at timestamp with time zone, expires_at timestamp with time zone, grace_ends_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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
$function$


CREATE OR REPLACE FUNCTION private.guard_clinic_subscription_payment_append()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$


-- Public application routines
CREATE OR REPLACE FUNCTION public.caller_clinic_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$


CREATE OR REPLACE FUNCTION public.caller_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$


CREATE OR REPLACE FUNCTION public.can_access_patient(pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN public.caller_role() = 'owner' THEN TRUE
    WHEN public.caller_role() = 'admin' THEN EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = pid AND p.clinic_id = public.caller_clinic_id()
        AND public.clinic_sub_active(p.clinic_id)
    )
    WHEN public.caller_role() = 'coach' THEN EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = pid AND p.clinic_id = public.caller_clinic_id()
        AND p.invited_by = auth.uid()
        AND public.clinic_sub_active(p.clinic_id)
    )
    ELSE pid = auth.uid() AND public.clinic_sub_active(public.caller_clinic_id())
  END;
$function$


CREATE OR REPLACE FUNCTION public.claim_push_subscription(p_endpoint text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$


CREATE OR REPLACE FUNCTION public.clinic_sub_active(cid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_subscriptions
    WHERE clinic_id = cid AND status IN ('active', 'grace')
  );
$function$


CREATE OR REPLACE FUNCTION public.enforce_invitation_consume()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_role TEXT;
BEGIN
  BEGIN
    v_role := (auth.jwt() ->> 'role');
  EXCEPTION
    WHEN OTHERS THEN
      v_role := NULL;
  END;

  IF OLD.status = 'pending' AND NEW.status = 'consumed' THEN
    IF NEW.role != OLD.role OR NEW.clinic_id != OLD.clinic_id
       OR NEW.created_by != OLD.created_by OR NEW.email != OLD.email THEN
      RAISE EXCEPTION 'Cannot modify invitation role, clinic, creator, or email';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'consumed' AND NEW.status = 'pending' THEN
    IF NEW.role != OLD.role OR NEW.clinic_id != OLD.clinic_id
       OR NEW.created_by != OLD.created_by OR NEW.email != OLD.email THEN
      RAISE EXCEPTION 'Cannot modify invitation role, clinic, creator, or email during re-open';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid invitation status transition: % -> %', OLD.status, NEW.status;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_clinic_subscription_gate(p_clinic_id text)
 RETURNS TABLE(plan text, status text, start_at timestamp with time zone, expires_at timestamp with time zone, grace_ends_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT *
  FROM private.get_clinic_subscription_gate(p_clinic_id);
$function$


CREATE OR REPLACE FUNCTION public.get_push_signing_config()
 RETURNS TABLE(vapid_public_key text, vapid_private_key text, vapid_subject text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_diet_vapid_public_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_diet_vapid_private_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_diet_vapid_subject' LIMIT 1);
$function$


CREATE OR REPLACE FUNCTION public.owner_create_clinic_with_owner(p_name text, p_owner_name text, p_owner_email text, p_owner_phone text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$


CREATE OR REPLACE FUNCTION public.owner_review_clinic_payment(p_clinic_id text, p_action text, p_plan text DEFAULT NULL::text, p_payment_index integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
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

  IF p_action IS NULL OR p_action NOT IN ('activate', 'reject') THEN
    RAISE EXCEPTION 'Unsupported payment action'
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'activate' AND (p_plan IS NULL OR p_plan NOT IN ('permanent', 'monthly', 'annual')) THEN
    RAISE EXCEPTION 'Unsupported subscription plan'
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'reject' AND length(btrim(coalesce(p_note, ''))) > 500 THEN
    RAISE EXCEPTION 'Rejection note is too long' USING ERRCODE = '22023';
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

    IF p_action = 'reject' AND length(btrim(coalesce(p_note, ''))) > 500 THEN
    RAISE EXCEPTION 'Rejection note is too long' USING ERRCODE = '22023';
  END IF;

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
$function$


CREATE OR REPLACE FUNCTION public.submit_clinic_payment_request(p_clinic_id text, p_request_id uuid, p_method text, p_amount numeric, p_reference text, p_note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
  v_profile_clinic_id text;
  v_disabled boolean;
  v_payments jsonb;
  v_request jsonb;
  v_existing jsonb;
  v_reference text := btrim(coalesce(p_reference, ''));
  v_note text := btrim(coalesce(p_note, ''));
  v_now timestamptz := clock_timestamp();
  v_rows integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.role, p.clinic_id, p.disabled
  INTO v_role, v_profile_clinic_id, v_disabled
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND OR v_role IS DISTINCT FROM 'admin' OR v_disabled IS TRUE THEN
    RAISE EXCEPTION 'Only an enabled clinic admin may submit a payment request'
      USING ERRCODE = '42501';
  END IF;

  IF p_clinic_id IS NULL OR p_clinic_id IS DISTINCT FROM v_profile_clinic_id THEN
    RAISE EXCEPTION 'Payment request is outside the authenticated admin clinic'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A requestId is required for idempotency'
      USING ERRCODE = '22023';
  END IF;

  IF p_method IS NULL OR p_method NOT IN ('instapay', 'vodafone_cash') THEN
    RAISE EXCEPTION 'Unsupported payment method'
      USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero and finite'
      USING ERRCODE = '22023';
  END IF;

  IF v_reference = '' OR length(v_reference) > 160 OR length(v_note) > 500 THEN
    RAISE EXCEPTION 'Payment reference or note is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = p_clinic_id AND c.status = 'suspended'
  ) THEN
    RAISE EXCEPTION 'A suspended clinic cannot submit a payment request'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(s.payments, '[]'::jsonb)
  INTO v_payments
  FROM public.clinic_subscriptions s
  WHERE s.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription exists for this clinic'
      USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(v_payments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Payment history is malformed'
      USING ERRCODE = '22023';
  END IF;

  SELECT item.value
  INTO v_existing
  FROM jsonb_array_elements(v_payments) AS item(value)
  WHERE item.value ->> 'requestId' = p_request_id::text
  LIMIT 1;

  IF FOUND THEN
    -- Reuse of an idempotency key with changed data is not a successful retry.
    IF v_existing ->> 'submittedBy' IS DISTINCT FROM v_uid::text
       OR v_existing ->> 'method' IS DISTINCT FROM p_method
       OR v_existing -> 'amount' IS DISTINCT FROM to_jsonb(p_amount)
       OR v_existing ->> 'reference' IS DISTINCT FROM v_reference
       OR coalesce(v_existing ->> 'note', '') IS DISTINCT FROM v_note THEN
      RAISE EXCEPTION 'Request ID was already used with different payment data'
        USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payments) AS item(value)
    WHERE item.value ->> 'reviewedAt' IS NULL
  ) THEN
    RAISE EXCEPTION 'A pending payment request already exists'
      USING ERRCODE = '23505';
  END IF;

  v_request := jsonb_build_object(
    'requestId', p_request_id::text,
    'method', p_method,
    'amount', p_amount,
    'currency', 'EGP',
    'reference', v_reference,
    'submittedAt', v_now,
    'submittedBy', v_uid::text,
    'reviewedAt', NULL,
    'reviewedBy', NULL,
    'note', v_note
  );

  UPDATE public.clinic_subscriptions
  SET payments = v_payments || jsonb_build_array(v_request),
      updated_at = v_now
  WHERE clinic_id = p_clinic_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Payment request was not appended to exactly one subscription';
  END IF;
END;
$function$


-- Revoke default PUBLIC and anon EXECUTE from all application routines
REVOKE ALL ON FUNCTION private.caller_clinic_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.caller_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_patient(pid uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_claim_invitation(p_role text, p_clinic_id text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.clinic_sub_active(cid text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.enforce_invitation_consume() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_clinic_subscription_gate(p_clinic_id text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.guard_clinic_subscription_payment_append() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.caller_clinic_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.caller_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_patient(pid uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_push_subscription(p_endpoint text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinic_sub_active(cid text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_invitation_consume() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_clinic_subscription_gate(p_clinic_id text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_push_signing_config() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_create_clinic_with_owner(p_name text, p_owner_name text, p_owner_email text, p_owner_phone text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_review_clinic_payment(p_clinic_id text, p_action text, p_plan text, p_payment_index integer, p_note text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_clinic_payment_request(p_clinic_id text, p_request_id uuid, p_method text, p_amount numeric, p_reference text, p_note text) FROM PUBLIC, anon;

-- Intended routine EXECUTE grants
GRANT EXECUTE ON FUNCTION private.caller_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_patient(pid uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_claim_invitation(p_role text, p_clinic_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.clinic_sub_active(cid text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_clinic_subscription_gate(p_clinic_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(p_endpoint text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_subscription_gate(p_clinic_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_signing_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_create_clinic_with_owner(p_name text, p_owner_name text, p_owner_email text, p_owner_phone text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_clinic_payment(p_clinic_id text, p_action text, p_plan text, p_payment_index integer, p_note text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_clinic_payment_request(p_clinic_id text, p_request_id uuid, p_method text, p_amount numeric, p_reference text, p_note text) TO authenticated;

-- Triggers
CREATE TRIGGER clinic_subscription_payment_append_guard BEFORE UPDATE ON clinic_subscriptions FOR EACH ROW EXECUTE FUNCTION private.guard_clinic_subscription_payment_append();
CREATE TRIGGER trg_invitation_consume BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION private.enforce_invitation_consume();

-- Row Level Security enablement
ALTER TABLE public.adherence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Production policies
CREATE POLICY adherence_configs_patient_or_staff_read ON public.adherence_configs AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.can_access_patient(adherence_configs.patient_id) AS can_access_patient));
CREATE POLICY adherence_configs_staff_delete ON public.adherence_configs AS PERMISSIVE FOR DELETE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_configs.patient_id) AS can_access_patient)));
CREATE POLICY adherence_configs_staff_insert ON public.adherence_configs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_configs.patient_id) AS can_access_patient) AND (updated_by = ( SELECT auth.uid() AS uid))));
CREATE POLICY adherence_configs_staff_update ON public.adherence_configs AS PERMISSIVE FOR UPDATE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_configs.patient_id) AS can_access_patient))) WITH CHECK (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_configs.patient_id) AS can_access_patient) AND (updated_by = ( SELECT auth.uid() AS uid))));
CREATE POLICY adherence_scores_patient_or_staff_read ON public.adherence_scores AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.can_access_patient(adherence_scores.patient_id) AS can_access_patient));
CREATE POLICY adherence_scores_staff_delete ON public.adherence_scores AS PERMISSIVE FOR DELETE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_scores.patient_id) AS can_access_patient)));
CREATE POLICY adherence_scores_staff_insert ON public.adherence_scores AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_scores.patient_id) AS can_access_patient) AND (entered_by = ( SELECT auth.uid() AS uid))));
CREATE POLICY adherence_scores_staff_update ON public.adherence_scores AS PERMISSIVE FOR UPDATE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_scores.patient_id) AS can_access_patient))) WITH CHECK (((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])) AND ( SELECT private.can_access_patient(adherence_scores.patient_id) AS can_access_patient) AND (entered_by = ( SELECT auth.uid() AS uid))));
CREATE POLICY subscriptions_owner_delete ON public.clinic_subscriptions AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY subscriptions_owner_insert ON public.clinic_subscriptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY subscriptions_select_authorized ON public.clinic_subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['coach'::text, 'admin'::text])) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)))));
CREATE POLICY subscriptions_update_authorized ON public.clinic_subscriptions AS PERMISSIVE FOR UPDATE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text) AND (p.clinic_id = clinic_subscriptions.clinic_id) AND (p.disabled IS NOT TRUE)))) AND (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = clinic_subscriptions.clinic_id) AND (c.status <> 'suspended'::text))))))) WITH CHECK (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text) AND (p.clinic_id = clinic_subscriptions.clinic_id) AND (p.disabled IS NOT TRUE)))) AND (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = clinic_subscriptions.clinic_id) AND (c.status <> 'suspended'::text)))))));
CREATE POLICY clinics_owner_delete ON public.clinics AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY clinics_owner_insert ON public.clinics AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY clinics_owner_update ON public.clinics AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text)) WITH CHECK ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY clinics_select_authorized ON public.clinics AS PERMISSIVE FOR SELECT TO authenticated USING (((id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) OR (( SELECT private.caller_role() AS caller_role) = 'owner'::text)));
CREATE POLICY consents_patient_insert_own ON public.consents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((patient_id = ( SELECT auth.uid() AS uid)) AND (granted_by = ( SELECT auth.uid() AS uid)) AND (( SELECT private.caller_role() AS caller_role) = 'patient'::text)));
CREATE POLICY consents_patient_read_own ON public.consents AS PERMISSIVE FOR SELECT TO authenticated USING (((patient_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.caller_role() AS caller_role) = 'patient'::text)));
CREATE POLICY consents_patient_update_own ON public.consents AS PERMISSIVE FOR UPDATE TO authenticated USING (((patient_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.caller_role() AS caller_role) = 'patient'::text))) WITH CHECK (((patient_id = ( SELECT auth.uid() AS uid)) AND (granted_by = ( SELECT auth.uid() AS uid)) AND (( SELECT private.caller_role() AS caller_role) = 'patient'::text)));
CREATE POLICY daylogs_access ON public.day_logs AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT private.can_access_patient(day_logs.patient_id) AS can_access_patient)) WITH CHECK (( SELECT private.can_access_patient(day_logs.patient_id) AS can_access_patient));
CREATE POLICY invitations_delete_owner ON public.invitations AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY invitations_insert_authorized ON public.invitations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (role = ANY (ARRAY['coach'::text, 'patient'::text])) AND (created_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(invitations.clinic_id) AS clinic_sub_active)) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (role = 'patient'::text) AND (created_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(invitations.clinic_id) AS clinic_sub_active))));
CREATE POLICY invitations_select_authorized ON public.invitations AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = ANY (ARRAY['admin'::text, 'coach'::text])) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id))) OR (email = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
CREATE POLICY invitations_update_authorized ON public.invitations AS PERMISSIVE FOR UPDATE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR (email = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id))) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (role = 'patient'::text) AND (created_by = ( SELECT auth.uid() AS uid))))) WITH CHECK (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((email = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (status = 'consumed'::text)) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (role = ANY (ARRAY['coach'::text, 'patient'::text]))) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (role = 'patient'::text) AND (created_by = ( SELECT auth.uid() AS uid)))));
CREATE POLICY patients_delete_authorized ON public.patients AS PERMISSIVE FOR DELETE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (invited_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active))));
CREATE POLICY patients_insert_authorized ON public.patients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (invited_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active))));
CREATE POLICY patients_select_authorized ON public.patients AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (invited_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)) OR ((id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(( SELECT private.caller_clinic_id() AS caller_clinic_id)) AS clinic_sub_active))));
CREATE POLICY patients_update_authorized ON public.patients AS PERMISSIVE FOR UPDATE TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (invited_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)))) WITH CHECK (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active)) OR ((( SELECT private.caller_role() AS caller_role) = 'coach'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (invited_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.clinic_sub_active(patients.clinic_id) AS clinic_sub_active))));
CREATE POLICY config_delete_owner ON public.platform_config AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY config_insert_owner ON public.platform_config AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY config_select_anon ON public.platform_config AS PERMISSIVE FOR SELECT TO anon USING (((value ->> 'public'::text) = 'true'::text));
CREATE POLICY config_select_authenticated ON public.platform_config AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((value ->> 'public'::text) = 'true'::text)));
CREATE POLICY config_update_owner ON public.platform_config AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text)) WITH CHECK ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY profiles_delete_owner ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY profiles_insert_authorized ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((id = ( SELECT auth.uid() AS uid)) AND (disabled = false) AND private.can_claim_invitation(role, clinic_id))));
CREATE POLICY profiles_select_authorized ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT private.caller_role() AS caller_role) = 'owner'::text) OR ((( SELECT private.caller_role() AS caller_role) = 'admin'::text) AND (clinic_id = ( SELECT private.caller_clinic_id() AS caller_clinic_id))) OR (id = ( SELECT auth.uid() AS uid))));
CREATE POLICY profiles_update_owner ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT private.caller_role() AS caller_role) = 'owner'::text)) WITH CHECK ((( SELECT private.caller_role() AS caller_role) = 'owner'::text));
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions AS PERMISSIVE FOR DELETE TO authenticated USING ((patient_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((patient_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.caller_role() AS caller_role) = 'patient'::text) AND ( SELECT private.clinic_sub_active(( SELECT private.caller_clinic_id() AS caller_clinic_id)) AS clinic_sub_active) AND (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = ( SELECT private.caller_clinic_id() AS caller_clinic_id)) AND (c.status = 'active'::text))))));
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING ((patient_id = ( SELECT auth.uid() AS uid)));

-- Schema privileges
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Table privileges
GRANT DELETE ON TABLE public.adherence_configs TO authenticated;
GRANT INSERT ON TABLE public.adherence_configs TO authenticated;
GRANT SELECT ON TABLE public.adherence_configs TO authenticated;
GRANT UPDATE ON TABLE public.adherence_configs TO authenticated;
GRANT DELETE ON TABLE public.adherence_configs TO service_role;
GRANT INSERT ON TABLE public.adherence_configs TO service_role;
GRANT REFERENCES ON TABLE public.adherence_configs TO service_role;
GRANT SELECT ON TABLE public.adherence_configs TO service_role;
GRANT TRIGGER ON TABLE public.adherence_configs TO service_role;
GRANT UPDATE ON TABLE public.adherence_configs TO service_role;
GRANT DELETE ON TABLE public.adherence_scores TO authenticated;
GRANT INSERT ON TABLE public.adherence_scores TO authenticated;
GRANT SELECT ON TABLE public.adherence_scores TO authenticated;
GRANT UPDATE ON TABLE public.adherence_scores TO authenticated;
GRANT DELETE ON TABLE public.adherence_scores TO service_role;
GRANT INSERT ON TABLE public.adherence_scores TO service_role;
GRANT REFERENCES ON TABLE public.adherence_scores TO service_role;
GRANT SELECT ON TABLE public.adherence_scores TO service_role;
GRANT TRIGGER ON TABLE public.adherence_scores TO service_role;
GRANT UPDATE ON TABLE public.adherence_scores TO service_role;
GRANT DELETE ON TABLE public.clinic_subscriptions TO authenticated;
GRANT INSERT ON TABLE public.clinic_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.clinic_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.clinic_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.clinic_subscriptions TO service_role;
GRANT INSERT ON TABLE public.clinic_subscriptions TO service_role;
GRANT REFERENCES ON TABLE public.clinic_subscriptions TO service_role;
GRANT SELECT ON TABLE public.clinic_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.clinic_subscriptions TO service_role;
GRANT UPDATE ON TABLE public.clinic_subscriptions TO service_role;
GRANT DELETE ON TABLE public.clinics TO authenticated;
GRANT INSERT ON TABLE public.clinics TO authenticated;
GRANT SELECT ON TABLE public.clinics TO authenticated;
GRANT UPDATE ON TABLE public.clinics TO authenticated;
GRANT DELETE ON TABLE public.clinics TO service_role;
GRANT INSERT ON TABLE public.clinics TO service_role;
GRANT REFERENCES ON TABLE public.clinics TO service_role;
GRANT SELECT ON TABLE public.clinics TO service_role;
GRANT TRIGGER ON TABLE public.clinics TO service_role;
GRANT UPDATE ON TABLE public.clinics TO service_role;
GRANT DELETE ON TABLE public.consents TO authenticated;
GRANT INSERT ON TABLE public.consents TO authenticated;
GRANT SELECT ON TABLE public.consents TO authenticated;
GRANT UPDATE ON TABLE public.consents TO authenticated;
GRANT DELETE ON TABLE public.consents TO service_role;
GRANT INSERT ON TABLE public.consents TO service_role;
GRANT REFERENCES ON TABLE public.consents TO service_role;
GRANT SELECT ON TABLE public.consents TO service_role;
GRANT TRIGGER ON TABLE public.consents TO service_role;
GRANT UPDATE ON TABLE public.consents TO service_role;
GRANT DELETE ON TABLE public.day_logs TO authenticated;
GRANT INSERT ON TABLE public.day_logs TO authenticated;
GRANT SELECT ON TABLE public.day_logs TO authenticated;
GRANT UPDATE ON TABLE public.day_logs TO authenticated;
GRANT DELETE ON TABLE public.day_logs TO service_role;
GRANT INSERT ON TABLE public.day_logs TO service_role;
GRANT REFERENCES ON TABLE public.day_logs TO service_role;
GRANT SELECT ON TABLE public.day_logs TO service_role;
GRANT TRIGGER ON TABLE public.day_logs TO service_role;
GRANT UPDATE ON TABLE public.day_logs TO service_role;
GRANT DELETE ON TABLE public.invitations TO authenticated;
GRANT INSERT ON TABLE public.invitations TO authenticated;
GRANT SELECT ON TABLE public.invitations TO authenticated;
GRANT UPDATE ON TABLE public.invitations TO authenticated;
GRANT DELETE ON TABLE public.invitations TO service_role;
GRANT INSERT ON TABLE public.invitations TO service_role;
GRANT REFERENCES ON TABLE public.invitations TO service_role;
GRANT SELECT ON TABLE public.invitations TO service_role;
GRANT TRIGGER ON TABLE public.invitations TO service_role;
GRANT UPDATE ON TABLE public.invitations TO service_role;
GRANT DELETE ON TABLE public.patients TO authenticated;
GRANT INSERT ON TABLE public.patients TO authenticated;
GRANT SELECT ON TABLE public.patients TO authenticated;
GRANT UPDATE ON TABLE public.patients TO authenticated;
GRANT DELETE ON TABLE public.patients TO service_role;
GRANT INSERT ON TABLE public.patients TO service_role;
GRANT REFERENCES ON TABLE public.patients TO service_role;
GRANT SELECT ON TABLE public.patients TO service_role;
GRANT TRIGGER ON TABLE public.patients TO service_role;
GRANT UPDATE ON TABLE public.patients TO service_role;
GRANT SELECT ON TABLE public.platform_config TO anon;
GRANT DELETE ON TABLE public.platform_config TO authenticated;
GRANT INSERT ON TABLE public.platform_config TO authenticated;
GRANT SELECT ON TABLE public.platform_config TO authenticated;
GRANT UPDATE ON TABLE public.platform_config TO authenticated;
GRANT DELETE ON TABLE public.platform_config TO service_role;
GRANT INSERT ON TABLE public.platform_config TO service_role;
GRANT REFERENCES ON TABLE public.platform_config TO service_role;
GRANT SELECT ON TABLE public.platform_config TO service_role;
GRANT TRIGGER ON TABLE public.platform_config TO service_role;
GRANT UPDATE ON TABLE public.platform_config TO service_role;
GRANT DELETE ON TABLE public.profiles TO authenticated;
GRANT INSERT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;
GRANT DELETE ON TABLE public.profiles TO service_role;
GRANT INSERT ON TABLE public.profiles TO service_role;
GRANT REFERENCES ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.profiles TO service_role;
GRANT TRIGGER ON TABLE public.profiles TO service_role;
GRANT UPDATE ON TABLE public.profiles TO service_role;
GRANT DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT INSERT ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.push_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.push_subscriptions TO service_role;
GRANT INSERT ON TABLE public.push_subscriptions TO service_role;
GRANT REFERENCES ON TABLE public.push_subscriptions TO service_role;
GRANT SELECT ON TABLE public.push_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.push_subscriptions TO service_role;
GRANT TRUNCATE ON TABLE public.push_subscriptions TO service_role;
GRANT UPDATE ON TABLE public.push_subscriptions TO service_role;

-- Sequence privileges
GRANT SELECT ON SEQUENCE public.adherence_scores_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.adherence_scores_id_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.adherence_scores_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.adherence_scores_id_seq TO service_role;
GRANT SELECT ON SEQUENCE public.consents_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.consents_id_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.consents_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.consents_id_seq TO service_role;
GRANT SELECT ON SEQUENCE public.day_logs_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.day_logs_id_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.day_logs_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.day_logs_id_seq TO service_role;

-- Default privileges for application-owned future objects
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT INSERT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT INSERT ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT MAINTAIN ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRIGGER ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE ON SEQUENCES TO service_role;

-- Least-privilege guard against non-DML access for Data API roles
REVOKE MAINTAIN, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

-- The Production Realtime publication contains only public.profiles.
DO $realtime$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END;
$realtime$;

-- Preserved table comments
COMMENT ON TABLE public.push_subscriptions IS 'Browser Web Push endpoints only. No patient names, clinical content, or private browser keys are stored.';

-- Verify critical reconstruction invariants.
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) <> 11 THEN
    RAISE EXCEPTION 'Expected exactly 11 Production public application tables';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Every public application table must have RLS enabled';
  END IF;
  IF NOT has_table_privilege('anon','public.platform_config','SELECT') THEN
    RAISE EXCEPTION 'The public platform_config SELECT path must remain available';
  END IF;
  IF NOT has_table_privilege('authenticated','public.patients','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Authenticated patient CRUD grants are missing';
  END IF;
  IF NOT has_table_privilege('authenticated','public.day_logs','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Authenticated day-log CRUD grants are missing';
  END IF;
END;
$verify$;

COMMIT;
