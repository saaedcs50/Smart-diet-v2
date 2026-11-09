-- Smart Diet v2 — Production legacy schema reconciliation
-- This bridge replays the reviewed Staging migration sequence onto the
-- restored legacy Production schema, then reconciles its helper ACLs and
-- remaining constraints. It is NOT the clean-room canonical baseline.
-- Preflighted on Production in a BEGIN/ROLLBACK transaction before this PR.

BEGIN;


-- Production was provisioned before the migration ledger was adopted.
-- Recreate the private authorization namespace/functions expected by the
-- canonical Staging migration sequence before replaying that sequence.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.caller_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION private.caller_clinic_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT clinic_id FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION private.clinic_sub_active(cid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.clinic_subscriptions
  WHERE clinic_id = cid AND status IN ('active','grace')
); $$;

CREATE OR REPLACE FUNCTION private.can_access_patient(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
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
$$;


-- Smart Diet v2 — Staging schema reconciliation
-- Date: 2026-11-09
-- Scope: additive/restrictive reconciliation against the manually provisioned
-- seven-table Staging database. This is NOT a fresh-project bootstrap migration.
-- The old baseline file is an inventory-only placeholder and must be replaced
-- by a canonical full baseline in a separate, reviewed change.

-- ---------------------------------------------------------------------------
-- 1. Missing tables referenced by the shipped application code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adherence_configs (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  axes jsonb NOT NULL,
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adherence_configs_axes_array CHECK (jsonb_typeof(axes) = 'array')
);

CREATE TABLE IF NOT EXISTS public.adherence_scores (
  id bigserial PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  score_date date NOT NULL,
  scores jsonb NOT NULL,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  entered_by uuid NOT NULL REFERENCES public.profiles(id),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adherence_scores_scores_array CHECK (jsonb_typeof(scores) = 'array')
);

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  tokens text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consents (
  id bigserial PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  consent jsonb NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consents_patient_purpose_key UNIQUE (patient_id, purpose)
);

-- day_logs.saveDayLog() uses ON CONFLICT(patient_id, log_date). The live
-- database had no such unique index. Duplicate keys and orphans were checked
-- to be zero before this migration.
CREATE UNIQUE INDEX IF NOT EXISTS day_logs_patient_id_log_date_uidx
  ON public.day_logs(patient_id, log_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.day_logs'::regclass
      AND conname = 'day_logs_patient_id_fkey'
  ) THEN
    ALTER TABLE public.day_logs
      ADD CONSTRAINT day_logs_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS patients_clinic_id_idx
  ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS patients_invited_by_idx
  ON public.patients(invited_by);
CREATE INDEX IF NOT EXISTS invitations_clinic_id_idx
  ON public.invitations(clinic_id);
CREATE INDEX IF NOT EXISTS adherence_scores_patient_date_idx
  ON public.adherence_scores(patient_id, score_date DESC);

-- ---------------------------------------------------------------------------
-- 2. RLS and least-privilege row policies for the four new tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.adherence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adherence_configs_patient_or_staff_read ON public.adherence_configs;
CREATE POLICY adherence_configs_patient_or_staff_read
  ON public.adherence_configs FOR SELECT TO authenticated
  USING ((SELECT private.can_access_patient(patient_id)));

DROP POLICY IF EXISTS adherence_configs_staff_insert ON public.adherence_configs;
CREATE POLICY adherence_configs_staff_insert
  ON public.adherence_configs FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
    AND updated_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS adherence_configs_staff_update ON public.adherence_configs;
CREATE POLICY adherence_configs_staff_update
  ON public.adherence_configs FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
  )
  WITH CHECK (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
    AND updated_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS adherence_configs_staff_delete ON public.adherence_configs;
CREATE POLICY adherence_configs_staff_delete
  ON public.adherence_configs FOR DELETE TO authenticated
  USING (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
  );

DROP POLICY IF EXISTS adherence_scores_patient_or_staff_read ON public.adherence_scores;
CREATE POLICY adherence_scores_patient_or_staff_read
  ON public.adherence_scores FOR SELECT TO authenticated
  USING ((SELECT private.can_access_patient(patient_id)));

DROP POLICY IF EXISTS adherence_scores_staff_insert ON public.adherence_scores;
CREATE POLICY adherence_scores_staff_insert
  ON public.adherence_scores FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
    AND entered_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS adherence_scores_staff_update ON public.adherence_scores;
CREATE POLICY adherence_scores_staff_update
  ON public.adherence_scores FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
  )
  WITH CHECK (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
    AND entered_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS adherence_scores_staff_delete ON public.adherence_scores;
CREATE POLICY adherence_scores_staff_delete
  ON public.adherence_scores FOR DELETE TO authenticated
  USING (
    (SELECT private.caller_role()) IN ('owner', 'admin', 'coach')
    AND (SELECT private.can_access_patient(patient_id))
  );

DROP POLICY IF EXISTS fcm_tokens_patient_manage_own ON public.fcm_tokens;
CREATE POLICY fcm_tokens_patient_manage_own
  ON public.fcm_tokens FOR ALL TO authenticated
  USING (patient_id = (SELECT auth.uid()))
  WITH CHECK (patient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS consents_patient_read_own ON public.consents;
CREATE POLICY consents_patient_read_own
  ON public.consents FOR SELECT TO authenticated
  USING (patient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS consents_patient_insert_own ON public.consents;
CREATE POLICY consents_patient_insert_own
  ON public.consents FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND granted_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS consents_patient_update_own ON public.consents;
CREATE POLICY consents_patient_update_own
  ON public.consents FOR UPDATE TO authenticated
  USING (patient_id = (SELECT auth.uid()))
  WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND granted_by = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Invitation lifecycle: role is granted only by a matching pending invite.
--    Invitees can consume their invite; staff may re-open it in their scope.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_claim_invitation(
  p_role text,
  p_clinic_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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
$function$;

REVOKE ALL ON FUNCTION private.can_claim_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_claim_invitation(text, text) TO authenticated;

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND disabled = false
    AND private.can_claim_invitation(role, clinic_id)
  );

DROP POLICY IF EXISTS inv_invitee_read ON public.invitations;
CREATE POLICY inv_invitee_read
  ON public.invitations FOR SELECT TO authenticated
  USING (email = lower((SELECT auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS inv_admin_create ON public.invitations;
CREATE POLICY inv_admin_create
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) = 'admin'
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND role IN ('coach', 'patient')
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS inv_coach_create ON public.invitations;
CREATE POLICY inv_coach_create
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) = 'coach'
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND role = 'patient'
    AND created_by = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS inv_invitee_consume ON public.invitations;
CREATE POLICY inv_invitee_consume
  ON public.invitations FOR UPDATE TO authenticated
  USING (email = lower((SELECT auth.jwt() ->> 'email')))
  WITH CHECK (
    email = lower((SELECT auth.jwt() ->> 'email'))
    AND status = 'consumed'
  );

DROP POLICY IF EXISTS inv_staff_update ON public.invitations;
CREATE POLICY inv_staff_update
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role = 'patient'
      AND created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role IN ('coach', 'patient')
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role = 'patient'
      AND created_by = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION private.enforce_invitation_consume()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
$function$;

-- ---------------------------------------------------------------------------
-- 4. Privileges, schema ACLs, sequence access and default privileges
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE USAGE ON SCHEMA private FROM anon;

REVOKE EXECUTE ON FUNCTION private.caller_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.caller_clinic_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.can_access_patient(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.clinic_sub_active(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.enforce_invitation_consume() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.caller_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.clinic_sub_active(text) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

REVOKE TRUNCATE
  ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL
  ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Realtime is used by PlatformAuthProvider to observe profile creation.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'profiles'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;


-- Smart Diet v2 — follow-up index and RLS init-plan tuning
-- Scope: existing manually-created Staging schema. No data mutations.

-- Cover the non-leading foreign key columns highlighted by Supabase advisors.
CREATE INDEX IF NOT EXISTS adherence_configs_updated_by_idx
  ON public.adherence_configs(updated_by);
CREATE INDEX IF NOT EXISTS adherence_scores_entered_by_idx
  ON public.adherence_scores(entered_by);
CREATE INDEX IF NOT EXISTS consents_granted_by_idx
  ON public.consents(granted_by);

-- Ensure per-statement auth lookups are evaluated once instead of per row.
DROP POLICY IF EXISTS patients_coach_read ON public.patients;
CREATE POLICY patients_coach_read
  ON public.patients FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'coach'
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND invited_by = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS patients_coach_write ON public.patients;
CREATE POLICY patients_coach_write
  ON public.patients FOR ALL TO authenticated
  USING (
    (SELECT private.caller_role()) = 'coach'
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND invited_by = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active(clinic_id))
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'coach'
    AND clinic_id = (SELECT private.caller_clinic_id())
    AND invited_by = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active(clinic_id))
  );

DROP POLICY IF EXISTS patients_self_read ON public.patients;
CREATE POLICY patients_self_read
  ON public.patients FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND (SELECT private.clinic_sub_active((SELECT private.caller_clinic_id())))
  );

DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Keep the JWT function itself inside the scalar subquery for planner init-plan.
DROP POLICY IF EXISTS inv_invitee_read ON public.invitations;
CREATE POLICY inv_invitee_read
  ON public.invitations FOR SELECT TO authenticated
  USING (email = lower(((SELECT auth.jwt()) ->> 'email')));

DROP POLICY IF EXISTS inv_invitee_consume ON public.invitations;
CREATE POLICY inv_invitee_consume
  ON public.invitations FOR UPDATE TO authenticated
  USING (email = lower(((SELECT auth.jwt()) ->> 'email')))
  WITH CHECK (
    email = lower(((SELECT auth.jwt()) ->> 'email'))
    AND status = 'consumed'
  );


-- Smart Diet v2 — atomic owner operations
-- Only callable by an enabled platform owner. All operations are transactional.

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


-- Tighten null argument handling for owner RPCs without redefining their
-- entire bodies. The functions are already installed by 20261109063122.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.owner_review_clinic_payment(text,text,text,integer,text)'::regprocedure
  ) INTO v_definition;

  IF position('IF p_action IS NULL OR p_action NOT IN' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      'IF p_action NOT IN (''activate'', ''reject'') THEN',
      'IF p_action IS NULL OR p_action NOT IN (''activate'', ''reject'') THEN'
    );
  END IF;

  IF position('p_plan IS NULL OR p_plan NOT IN' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      'IF p_action = ''activate'' AND p_plan NOT IN (''permanent'', ''monthly'', ''annual'') THEN',
      'IF p_action = ''activate'' AND (p_plan IS NULL OR p_plan NOT IN (''permanent'', ''monthly'', ''annual'')) THEN'
    );
  END IF;

  IF position('length(btrim(coalesce(p_note, ''''))) > 500' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      'IF p_action = ''reject''',
      'IF p_action = ''reject'' AND length(btrim(coalesce(p_note, ''''))) > 500 THEN
    RAISE EXCEPTION ''Rejection note is too long'' USING ERRCODE = ''22023'';
  END IF;

  IF p_action = ''reject'''
    );
  END IF;

  IF position('p_action IS NULL OR p_action NOT IN' IN v_definition) = 0
     OR position('p_plan IS NULL OR p_plan NOT IN' IN v_definition) = 0
     OR position('Rejection note is too long' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely apply owner RPC validation changes';
  END IF;

  EXECUTE v_definition;
END;
$migration$;

-- Owner RPCs are callable only by authenticated users and must not elevate
-- their privileges. Keep explicit role checks and let caller RLS remain active.
ALTER FUNCTION public.owner_create_clinic_with_owner(text, text, text, text)
  SECURITY INVOKER;
ALTER FUNCTION public.owner_review_clinic_payment(text, text, text, integer, text)
  SECURITY INVOKER;


-- PRIV/SEC: clinic staff must not enumerate every patient's profile row.
-- The admin team screen is the only client consumer of the clinic-wide query.
-- Coaches and patients may read only their own profile row.

DROP POLICY IF EXISTS profiles_staff_clinic_read ON public.profiles;

CREATE POLICY profiles_admin_clinic_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.caller_role()) = 'admin'
    AND clinic_id = (SELECT private.caller_clinic_id())
  );

ALTER POLICY profiles_owner_all
  ON public.profiles
  TO authenticated;


-- Make the RLS boundary explicit and reproducible for all platform tables.
-- Existing policies are retained; this statement is idempotent.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;


-- Reconcile legacy policies that existed only in the manually-provisioned
-- Staging catalog. Replace PUBLIC policies with authenticated-only policies
-- and consolidate overlapping clinic/subscription policies.

-- CLINICS: one read policy and one update policy, with owner writes separate.
DROP POLICY IF EXISTS clinics_owner_all ON public.clinics;
DROP POLICY IF EXISTS clinics_member_read ON public.clinics;
DROP POLICY IF EXISTS clinics_admin_update ON public.clinics;

CREATE POLICY clinics_select_authorized
  ON public.clinics FOR SELECT TO authenticated
  USING (
    id = (SELECT private.caller_clinic_id())
    OR (SELECT private.caller_role()) = 'owner'
  );

CREATE POLICY clinics_owner_insert
  ON public.clinics FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY clinics_update_authorized
  ON public.clinics FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND id = (SELECT private.caller_clinic_id())
    )
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND id = (SELECT private.caller_clinic_id())
    )
  );

CREATE POLICY clinics_owner_delete
  ON public.clinics FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');

-- CLINIC SUBSCRIPTIONS: staff may read their clinic's subscription; only the
-- platform owner may insert, update or delete subscription records.
DROP POLICY IF EXISTS subs_owner_all ON public.clinic_subscriptions;
DROP POLICY IF EXISTS subs_staff_read ON public.clinic_subscriptions;

CREATE POLICY subscriptions_select_authorized
  ON public.clinic_subscriptions FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) IN ('coach', 'admin')
      AND clinic_id = (SELECT private.caller_clinic_id())
    )
  );

CREATE POLICY subscriptions_owner_insert
  ON public.clinic_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY subscriptions_owner_update
  ON public.clinic_subscriptions FOR UPDATE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner')
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY subscriptions_owner_delete
  ON public.clinic_subscriptions FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');

-- DAY LOGS: preserve the shared access helper, but do not attach the policy
-- to PUBLIC. Both row visibility and writes use the same patient scope.
DROP POLICY IF EXISTS daylogs_access ON public.day_logs;
CREATE POLICY daylogs_access
  ON public.day_logs FOR ALL TO authenticated
  USING ((SELECT private.can_access_patient(patient_id)))
  WITH CHECK ((SELECT private.can_access_patient(patient_id)));


-- Remove unintended PUBLIC membership from policy predicates over private
-- clinic/patient data. Keep config_read_public intentionally public.

ALTER POLICY inv_owner_all ON public.invitations TO authenticated;
ALTER POLICY inv_staff_read ON public.invitations TO authenticated;

ALTER POLICY patients_admin_write ON public.patients TO authenticated;
ALTER POLICY patients_owner_all ON public.patients TO authenticated;
ALTER POLICY patients_admin_read ON public.patients TO authenticated;

ALTER POLICY config_owner_write ON public.platform_config TO authenticated;


-- Consolidate overlapping RLS policies without changing the role boundaries.
-- Keep one policy per table/action where practical to reduce policy planning
-- overhead and make the authorization contract auditable.

-- ---------------------------------------------------------------------------
-- PATIENTS: one SELECT/INSERT/UPDATE/DELETE policy per command.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS patients_admin_write ON public.patients;
DROP POLICY IF EXISTS patients_coach_write ON public.patients;
DROP POLICY IF EXISTS patients_owner_all ON public.patients;
DROP POLICY IF EXISTS patients_admin_read ON public.patients;
DROP POLICY IF EXISTS patients_coach_read ON public.patients;
DROP POLICY IF EXISTS patients_self_read ON public.patients;

CREATE POLICY patients_select_authorized
  ON public.patients FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND invited_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      id = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active((SELECT private.caller_clinic_id())))
    )
  );

CREATE POLICY patients_insert_authorized
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND invited_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
  );

CREATE POLICY patients_update_authorized
  ON public.patients FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND invited_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND invited_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
  );

CREATE POLICY patients_delete_authorized
  ON public.patients FOR DELETE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND invited_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
  );

-- ---------------------------------------------------------------------------
-- INVITATIONS: preserve invitee read/consume, scoped staff and owner access.
-- The trigger still prevents identity mutation and invalid status changes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS inv_owner_all ON public.invitations;
DROP POLICY IF EXISTS inv_admin_create ON public.invitations;
DROP POLICY IF EXISTS inv_coach_create ON public.invitations;
DROP POLICY IF EXISTS inv_invitee_read ON public.invitations;
DROP POLICY IF EXISTS inv_staff_read ON public.invitations;
DROP POLICY IF EXISTS inv_invitee_consume ON public.invitations;
DROP POLICY IF EXISTS inv_staff_update ON public.invitations;

CREATE POLICY invitations_select_authorized
  ON public.invitations FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) IN ('admin', 'coach')
      AND clinic_id = (SELECT private.caller_clinic_id())
    )
    OR email = lower(((SELECT auth.jwt()) ->> 'email'))
  );

CREATE POLICY invitations_insert_authorized
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role IN ('coach', 'patient')
      AND created_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role = 'patient'
      AND created_by = (SELECT auth.uid())
      AND (SELECT private.clinic_sub_active(clinic_id))
    )
  );

CREATE POLICY invitations_update_authorized
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR email = lower(((SELECT auth.jwt()) ->> 'email'))
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role = 'patient'
      AND created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      email = lower(((SELECT auth.jwt()) ->> 'email'))
      AND status = 'consumed'
    )
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role IN ('coach', 'patient')
    )
    OR (
      (SELECT private.caller_role()) = 'coach'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND role = 'patient'
      AND created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY invitations_delete_owner
  ON public.invitations FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');

-- ---------------------------------------------------------------------------
-- PROFILES: one SELECT policy and one INSERT policy; writes after onboarding
-- remain owner-only. The admin may list team profiles, the coach may not.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_owner_all ON public.profiles;
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_clinic_read ON public.profiles;
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;

CREATE POLICY profiles_select_authorized
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
    )
    OR id = (SELECT auth.uid())
  );

CREATE POLICY profiles_insert_authorized
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      id = (SELECT auth.uid())
      AND disabled = false
      AND private.can_claim_invitation(role, clinic_id)
    )
  );

CREATE POLICY profiles_update_owner
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner')
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY profiles_delete_owner
  ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');

-- ---------------------------------------------------------------------------
-- PLATFORM CONFIG: one read policy keeps public rows public and owner rows
-- owner-only. All writes remain restricted to the authenticated platform owner.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS config_owner_write ON public.platform_config;
DROP POLICY IF EXISTS config_read_public ON public.platform_config;

CREATE POLICY config_select_authorized
  ON public.platform_config FOR SELECT TO public
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR value ->> 'public' = 'true'
  );

CREATE POLICY config_insert_owner
  ON public.platform_config FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY config_update_owner
  ON public.platform_config FOR UPDATE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner')
  WITH CHECK ((SELECT private.caller_role()) = 'owner');

CREATE POLICY config_delete_owner
  ON public.platform_config FOR DELETE TO authenticated
  USING ((SELECT private.caller_role()) = 'owner');


-- Split the public config read from the authenticated-owner read. This
-- prevents anon from needing EXECUTE/USAGE on the private helper schema.

DROP POLICY IF EXISTS config_select_authorized ON public.platform_config;

CREATE POLICY config_select_anon
  ON public.platform_config FOR SELECT TO anon
  USING (value ->> 'public' = 'true');

CREATE POLICY config_select_authenticated
  ON public.platform_config FOR SELECT TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR value ->> 'public' = 'true'
  );


-- The restored Production database has no application rows at this point.
-- Align nullable/check constraints with the reviewed Staging schema.
ALTER TABLE public.adherence_configs ALTER COLUMN axes SET NOT NULL;
ALTER TABLE public.adherence_configs ALTER COLUMN updated_by SET NOT NULL;
ALTER TABLE public.adherence_scores ALTER COLUMN scores SET NOT NULL;
ALTER TABLE public.adherence_scores ALTER COLUMN entered_by SET NOT NULL;
ALTER TABLE public.consents ALTER COLUMN granted_by SET NOT NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.adherence_configs'::regclass AND conname='adherence_configs_axes_array') THEN
  ALTER TABLE public.adherence_configs ADD CONSTRAINT adherence_configs_axes_array CHECK (jsonb_typeof(axes)='array');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.adherence_scores'::regclass AND conname='adherence_scores_scores_array') THEN
  ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_scores_array CHECK (jsonb_typeof(scores)='array');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.adherence_scores'::regclass AND conname='adherence_scores_overall_range') THEN
  ALTER TABLE public.adherence_scores ADD CONSTRAINT adherence_scores_overall_range CHECK (overall >= 0 AND overall <= 100);
 END IF;
END $$;

-- Rebind the trigger to the private non-RPC trigger function.
DROP TRIGGER IF EXISTS trg_invitation_consume ON public.invitations;
CREATE TRIGGER trg_invitation_consume
 BEFORE UPDATE ON public.invitations
 FOR EACH ROW EXECUTE FUNCTION private.enforce_invitation_consume();

-- Keep anonymous reads restricted to explicitly public platform configuration.
GRANT SELECT ON public.platform_config TO anon;

-- RLS does not cover TRUNCATE; remove the grant from all API roles,
-- including service_role, to match the reviewed least-privilege baseline.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;

-- Retire exposed legacy SECURITY DEFINER helpers only after all policies
-- and the invitation trigger have been moved to private helpers.
REVOKE EXECUTE ON FUNCTION public.caller_role() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.caller_clinic_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.clinic_sub_active(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_access_patient(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_invitation_consume() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
