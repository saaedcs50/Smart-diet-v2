-- Split the public config read from the authenticated-owner read. This
-- prevents anon from needing EXECUTE/USAGE on the private helper schema.

BEGIN;

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

COMMIT;
