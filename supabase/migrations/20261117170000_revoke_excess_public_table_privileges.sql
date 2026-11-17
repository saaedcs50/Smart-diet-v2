-- Least-privilege hardening for the Supabase Data API roles.
-- Production had extra MAINTAIN, REFERENCES and TRIGGER grants on public tables,
-- plus broad postgres default table privileges that Staging did not have.
-- Preserve the existing SELECT-only public platform_config path and the
-- authenticated DML privileges already granted to application tables.

BEGIN;

REVOKE MAINTAIN, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- New application tables created by migrations run as postgres must not
-- inherit the same unnecessary non-DML privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE MAINTAIN, REFERENCES, TRIGGER ON TABLES
  FROM anon, authenticated;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND a.grantee IN (
        'anon'::regrole::oid,
        'authenticated'::regrole::oid
      )
      AND a.privilege_type IN ('MAINTAIN', 'REFERENCES', 'TRIGGER')
  ) THEN
    RAISE EXCEPTION 'Unexpected non-DML table grants remain for anon/authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole
      AND d.defaclobjtype = 'r'
      AND n.nspname = 'public'
      AND a.grantee IN (
        'anon'::regrole::oid,
        'authenticated'::regrole::oid
      )
      AND a.privilege_type IN ('MAINTAIN', 'REFERENCES', 'TRIGGER')
  ) THEN
    RAISE EXCEPTION 'Unexpected default non-DML table grants remain for postgres';
  END IF;

  IF NOT has_table_privilege('anon', 'public.platform_config', 'SELECT') THEN
    RAISE EXCEPTION 'The explicitly public platform_config SELECT grant was lost';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.patients', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.patients', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.patients', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.patients', 'DELETE') THEN
    RAISE EXCEPTION 'Required authenticated patient-table DML grants were changed';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.day_logs', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.day_logs', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.day_logs', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.day_logs', 'DELETE') THEN
    RAISE EXCEPTION 'Required authenticated day-log DML grants were changed';
  END IF;
END;
$verify$;

COMMIT;
