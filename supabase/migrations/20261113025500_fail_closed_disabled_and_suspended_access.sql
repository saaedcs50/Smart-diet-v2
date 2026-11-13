-- Centralize fail-closed handling for disabled users and suspended clinics.
-- RLS policies call these helpers, so one correction protects every dependent table.

BEGIN;

CREATE OR REPLACE FUNCTION private.caller_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION private.caller_clinic_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$;

-- Keep legacy public helpers consistent with the private helpers if any
-- older client or policy still references them.
CREATE OR REPLACE FUNCTION public.caller_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.caller_clinic_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.disabled IS NOT TRUE
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION private.clinic_sub_active(cid text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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

COMMIT;
