-- Smart Diet v2 — follow-up index and RLS init-plan tuning
-- Scope: existing manually-created Staging schema. No data mutations.

BEGIN;

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

COMMIT;
