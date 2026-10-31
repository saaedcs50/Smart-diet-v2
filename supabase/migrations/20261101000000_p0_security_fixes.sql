-- ============================================================================
-- P0 Security Fixes — Post-PR33 Independent Audit
-- ============================================================================
-- Applies critical security hardening identified in the post-PR33 audit:
--   SDV2-SEC-004: Harden SECURITY DEFINER functions (search_path, EXECUTE)
--   SDV2-SEC-005: Revoke TRUNCATE on consents from anon/authenticated
--   P0-1: Fix profiles_self_insert privilege escalation (role self-assignment)
--   P0-2: Fix inv_invitee_consume privilege escalation (role/clinic mutation)
--   P0-3: Narrow config_read to public configuration only
--
-- Apply via Supabase Dashboard SQL Editor. Verify with the queries at the end.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SDV2-SEC-004: Harden SECURITY DEFINER functions
-- ----------------------------------------------------------------------------
-- Prevent search_path poisoning: force empty search_path so all object
-- references resolve only via schema-qualified names.

ALTER FUNCTION public.caller_role() SET search_path = '';
ALTER FUNCTION public.caller_clinic_id() SET search_path = '';
ALTER FUNCTION public.clinic_sub_active(text) SET search_path = '';
ALTER FUNCTION public.can_access_patient(uuid) SET search_path = '';

-- clinic_sub_active(cid) accepts any clinic ID and returns subscription state.
-- An authenticated user could enumerate subscription status for arbitrary clinics.
-- Revoke direct EXECUTE; all legitimate access goes through RLS policies
-- (which call these functions internally during policy evaluation).

REVOKE EXECUTE ON FUNCTION public.clinic_sub_active(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinic_sub_active(text) FROM authenticated;

-- caller_role, caller_clinic_id, can_access_patient are invoked by Postgres
-- during RLS policy evaluation (not directly by clients), so their EXECUTE
-- grants are left for the policy engine. They are now search_path-safe.

-- ----------------------------------------------------------------------------
-- SDV2-SEC-005: Revoke TRUNCATE on consents from anon/authenticated
-- ----------------------------------------------------------------------------
-- RLS does not protect against TRUNCATE. The consents table was created after
-- the original grant fix and inherited permissive defaults.

REVOKE TRUNCATE ON public.consents FROM anon;
REVOKE TRUNCATE ON public.consents FROM authenticated;

-- Belt-and-braces: ensure no other public table grants TRUNCATE to anon/auth.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM anon', t);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- P0-1: Fix profiles_self_insert privilege escalation
-- ----------------------------------------------------------------------------
-- BEFORE: WITH CHECK (id = auth.uid()) — allowed self-assigning role='owner'.
-- AFTER:  New users may only self-insert with role='patient' and disabled=false.
--         Staff roles (coach/admin/owner) must be provisioned server-side via
--         the invitation flow (service_role), never by client self-insert.

DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;

CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
    AND role = 'patient'
    AND disabled = false
  );

-- ----------------------------------------------------------------------------
-- P0-2: Fix inv_invitee_consume privilege escalation
-- ----------------------------------------------------------------------------
-- BEFORE: WITH CHECK only constrained email + status='consumed',
--         allowing the invitee to mutate role/clinic_id/created_by.
-- AFTER:  Column-level restriction — invitees may only transition status
--         pending -> consumed. Role/clinic/creator are immutable to clients.
--         (Enforced via trigger since RLS WITH CHECK cannot compare OLD/NEW.)

DROP POLICY IF EXISTS "inv_invitee_consume" ON public.invitations;

-- Narrow policy: invitee can UPDATE only their own row, and only to consumed.
CREATE POLICY "inv_invitee_consume" ON public.invitations
  FOR UPDATE USING (
    email = lower(auth.jwt() ->> 'email')
  ) WITH CHECK (
    email = lower(auth.jwt() ->> 'email')
    AND status = 'consumed'
  );

-- Trigger: prevent invitees from changing role/clinic_id/created_by.
-- Only service_role (bypasses RLS, but trigger still fires) or staff with
-- proper policies may alter these columns. For invitee updates, enforce
-- immutability of authorization-bearing columns.

CREATE OR REPLACE FUNCTION public.enforce_invitation_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Allow service_role to bypass (it manages invitations server-side)
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'invitation role is immutable';
  END IF;
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id THEN
    RAISE EXCEPTION 'invitation clinic_id is immutable';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'invitation created_by is immutable';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'invitation email is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitation_immutable_cols ON public.invitations;
CREATE TRIGGER trg_invitation_immutable_cols
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invitation_immutable_cols();

-- ----------------------------------------------------------------------------
-- P0-3: Narrow config_read to public configuration only
-- ----------------------------------------------------------------------------
-- BEFORE: USING (auth.uid() IS NOT NULL) — every signed-in user could read
--         ALL platform_config rows, including future private settings.
-- AFTER:  Only rows explicitly marked public are readable by authenticated
--         users. Owner-only settings require the owner policy.

DROP POLICY IF EXISTS "config_read" ON public.platform_config;

-- Public config: rows where value->>'public' = 'true'
CREATE POLICY "config_read_public" ON public.platform_config
  FOR SELECT USING (
    (value ->> 'public') = 'true'
  );

-- Owner can read all config (existing owner policy, if any, remains).
-- If no owner policy exists, service_role bypasses RLS for admin tasks.

-- ----------------------------------------------------------------------------
-- Verification queries (run after applying)
-- ----------------------------------------------------------------------------
-- 1. Functions hardened:
--    SELECT proname, proconfig FROM pg_proc
--     WHERE pronamespace = 'public'::regnamespace AND prosecdef = true;
--    -- proconfig should contain {search_path=} for all 4 functions.
--
-- 2. TRUNCATE revoked:
--    SELECT table_name, grantee, privilege_type
--      FROM information_schema.role_table_grants
--     WHERE table_schema = 'public' AND privilege_type = 'TRUNCATE'
--       AND grantee IN ('anon', 'authenticated');
--    -- Should return zero rows.
--
-- 3. Policies:
--    SELECT policyname, cmd, roles FROM pg_policies
--     WHERE schemaname = 'public'
--       AND tablename IN ('profiles', 'invitations', 'platform_config');
