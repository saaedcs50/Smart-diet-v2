-- Consolidate overlapping RLS policies without changing the role boundaries.
-- Keep one policy per table/action where practical to reduce policy planning
-- overhead and make the authorization contract auditable.

BEGIN;

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

COMMIT;
