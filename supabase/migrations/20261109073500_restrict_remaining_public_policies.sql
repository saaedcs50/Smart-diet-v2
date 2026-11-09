-- Remove unintended PUBLIC membership from policy predicates over private
-- clinic/patient data. Keep config_read_public intentionally public.
BEGIN;

ALTER POLICY inv_owner_all ON public.invitations TO authenticated;
ALTER POLICY inv_staff_read ON public.invitations TO authenticated;

ALTER POLICY patients_admin_write ON public.patients TO authenticated;
ALTER POLICY patients_owner_all ON public.patients TO authenticated;
ALTER POLICY patients_admin_read ON public.patients TO authenticated;

ALTER POLICY config_owner_write ON public.platform_config TO authenticated;

COMMIT;
