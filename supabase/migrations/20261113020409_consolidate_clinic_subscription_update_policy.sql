-- Consolidate owner and admin subscription UPDATE authorization into one policy.
-- Avoid multiple permissive UPDATE policies while preserving role boundaries.

BEGIN;

DROP POLICY IF EXISTS subscriptions_admin_payment_request_update
  ON public.clinic_subscriptions;
DROP POLICY IF EXISTS subscriptions_owner_update
  ON public.clinic_subscriptions;

CREATE POLICY subscriptions_update_authorized
  ON public.clinic_subscriptions FOR UPDATE TO authenticated
  USING (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'admin'
          AND p.clinic_id = clinic_subscriptions.clinic_id
          AND p.disabled IS NOT TRUE
      )
      AND EXISTS (
        SELECT 1
        FROM public.clinics c
        WHERE c.id = clinic_subscriptions.clinic_id
          AND c.status <> 'suspended'
      )
    )
  )
  WITH CHECK (
    (SELECT private.caller_role()) = 'owner'
    OR (
      (SELECT private.caller_role()) = 'admin'
      AND clinic_id = (SELECT private.caller_clinic_id())
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'admin'
          AND p.clinic_id = clinic_subscriptions.clinic_id
          AND p.disabled IS NOT TRUE
      )
      AND EXISTS (
        SELECT 1
        FROM public.clinics c
        WHERE c.id = clinic_subscriptions.clinic_id
          AND c.status <> 'suspended'
      )
    )
  );

COMMIT;
