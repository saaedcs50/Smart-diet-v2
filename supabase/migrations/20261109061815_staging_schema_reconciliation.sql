-- Smart Diet v2 — Staging schema reconciliation
-- Date: 2026-11-09
-- Scope: additive/restrictive reconciliation against the manually provisioned
-- seven-table Staging database. This is NOT a fresh-project bootstrap migration.
-- The old baseline file is an inventory-only placeholder and must be replaced
-- by a canonical full baseline in a separate, reviewed change.

BEGIN;

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

COMMIT;
