-- ============================================================================
-- C1 restore-test bootstrap seed — production chain (TEST ONLY, not a migration)
--
-- Reconstructed from supabase/baselines/production-schema.sql (2026-11-17).
-- Provides what the migration files assume but Git cannot: the 7 core tables,
-- the 3 pre-existing adherence/consents tables, the 9 legacy helper
-- functions, the 7 legacy policies (as permissive stubs — their predicates
-- are unrecoverable and all are dropped by the chains), legacy indexes, and
-- the 3 sequences. See docs/migration-reconciliation-2026-11-21.md §4/§6.2
--
-- Deliberately EXCLUDED so the migrations do real work: patients.tags +
-- patients_tags_valid (Nov-14), push_subscriptions (Nov-17), appointments
-- (staging only). day_logs keeps its legacy _key unique constraint.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Sequences (legacy serial-style ids)
CREATE SEQUENCE public.adherence_scores_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.consents_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.day_logs_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

-- Tables (legacy definitions from the baseline snapshot)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role text NOT NULL,
  clinic_id text NOT NULL,
  email text,
  display_name text,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.clinics (
  id text NOT NULL,
  name text NOT NULL,
  owner_uid text NOT NULL DEFAULT ''::text,
  owner_name text,
  owner_phone text,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.clinic_subscriptions (
  clinic_id text NOT NULL,
  plan text NOT NULL,
  status text NOT NULL,
  start_at timestamp with time zone,
  expires_at timestamp with time zone,
  grace_ends_at timestamp with time zone,
  payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_config (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.invitations (
  email text NOT NULL,
  role text NOT NULL,
  clinic_id text NOT NULL,
  created_by uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id uuid NOT NULL,
  clinic_id text NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb,
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.day_logs (
  id bigint NOT NULL DEFAULT nextval('day_logs_id_seq'::regclass),
  patient_id uuid NOT NULL,
  log_date date NOT NULL,
  log jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.adherence_configs (
  patient_id uuid NOT NULL,
  axes jsonb NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.adherence_scores (
  id bigint NOT NULL DEFAULT nextval('adherence_scores_id_seq'::regclass),
  patient_id uuid NOT NULL,
  score_date date NOT NULL,
  scores jsonb NOT NULL,
  overall numeric NOT NULL,
  entered_by uuid NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.consents (
  id bigint NOT NULL DEFAULT nextval('consents_id_seq'::regclass),
  patient_id uuid NOT NULL,
  purpose text NOT NULL,
  consent jsonb NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Constraints (legacy; no migration file creates these)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['patient'::text, 'coach'::text, 'admin'::text, 'owner'::text]));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.clinics ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);
ALTER TABLE public.clinics ADD CONSTRAINT clinics_status_check CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text]));
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_pkey PRIMARY KEY (clinic_id);
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_plan_check CHECK (plan = ANY (ARRAY['permanent'::text, 'monthly'::text, 'annual'::text]));
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'grace'::text, 'expired'::text]));
ALTER TABLE public.clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
ALTER TABLE public.platform_config ADD CONSTRAINT platform_config_pkey PRIMARY KEY (key);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_pkey PRIMARY KEY (email);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK (role = ANY (ARRAY['patient'::text, 'coach'::text, 'admin'::text]));
ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'consumed'::text]));
ALTER TABLE public.patients ADD CONSTRAINT patients_pkey PRIMARY KEY (id);
ALTER TABLE public.patients ADD CONSTRAINT patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
ALTER TABLE public.patients ADD CONSTRAINT patients_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.day_logs ADD CONSTRAINT day_logs_patient_id_log_date_key UNIQUE (patient_id, log_date);
ALTER TABLE public.day_logs ADD CONSTRAINT day_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.day_logs ADD CONSTRAINT day_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_axes_array CHECK (jsonb_typeof(axes) = 'array'::text);
ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_pkey PRIMARY KEY (patient_id);
ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_overall_range CHECK (overall >= 0::numeric AND overall <= 100::numeric);
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_pkey PRIMARY KEY (id);
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_scores_array CHECK (jsonb_typeof(scores) = 'array'::text);
ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE public.consents ADD CONSTRAINT consents_patient_id_purpose_key UNIQUE (patient_id, purpose);
ALTER TABLE public.consents ADD CONSTRAINT consents_pkey PRIMARY KEY (id);
ALTER TABLE public.consents ADD CONSTRAINT consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- Sequence ownership
ALTER SEQUENCE public.adherence_scores_id_seq OWNED BY public.adherence_scores.id;
ALTER SEQUENCE public.consents_id_seq OWNED BY public.consents.id;
ALTER SEQUENCE public.day_logs_id_seq OWNED BY public.day_logs.id;

-- Legacy indexes (definitions assumed; the Nov-13 remove-duplicates
-- migration drops the idx_* ones by name only)
CREATE INDEX idx_consents_patient ON public.consents USING btree (patient_id);
CREATE INDEX idx_adherence_scores_patient ON public.adherence_scores USING btree (patient_id);
CREATE INDEX idx_day_logs_patient ON public.day_logs USING btree (patient_id);
CREATE INDEX idx_patients_clinic ON public.patients USING btree (clinic_id);
CREATE INDEX idx_patients_invited_by ON public.patients USING btree (invited_by);

-- Legacy helper functions (bodies verbatim from the baseline — the only record)
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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;

-- Legacy policies as permissive stubs (predicates unrecoverable; the chains
-- ALTER then DROP all of them, so the end state is unaffected)
CREATE POLICY profiles_owner_all ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY inv_owner_all ON public.invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY inv_staff_read ON public.invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY patients_admin_write ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY patients_owner_all ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY patients_admin_read ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY config_owner_write ON public.platform_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS on (the chains re-enable idempotently)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
