import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const baselinePath = new URL('../supabase/baselines/production-schema.sql', import.meta.url);
const source = await readFile(baselinePath, 'utf8');

// PGlite provides a real PostgreSQL engine in-process. Stub only Supabase-owned
// catalog dependencies and skip extension installation/publication DDL, which
// require the managed Supabase control plane rather than application SQL.
const sql = source
  .replace(/^CREATE EXTENSION IF NOT EXISTS .*;\s*$/gm, '')
  .replace(
    /-- The Production Realtime publication[\s\S]*?\$realtime\$;\s*/,
    '-- supabase_realtime membership is verified against the live project separately.\n',
  );

const db = new PGlite();

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;

    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);

    CREATE SCHEMA vault;
    CREATE TABLE vault.decrypted_secrets (
      name text PRIMARY KEY,
      decrypted_secret text NOT NULL
    );

    CREATE SCHEMA extensions;

    CREATE FUNCTION auth.uid()
    RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT NULL::uuid $$;

    CREATE FUNCTION auth.jwt()
    RETURNS jsonb LANGUAGE sql STABLE
    AS $$ SELECT '{}'::jsonb $$;
  `);

  await db.exec(sql);

  const checks = await db.query(`
    SELECT
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS tables,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public') AS indexes,
      (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f') AS routines,
      (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) AS triggers,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity) AS rls_tables,
      (SELECT count(*)::int FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype IN ('p','u','f','c','x')) AS constraints
  `);

  const actual = checks.rows[0];
  const expected = {
    tables: 11,
    policies: 40,
    indexes: 23,
    routines: 19,
    triggers: 2,
    rls_tables: 11,
    constraints: 33,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`Baseline mismatch for ${key}: expected ${value}, got ${actual[key]}`);
    }
  }

  const privilegeCheck = await db.query(`
    SELECT
      has_table_privilege('anon','public.platform_config','SELECT') AS anon_public_config,
      has_table_privilege('authenticated','public.patients','SELECT,INSERT,UPDATE,DELETE') AS patient_crud,
      has_table_privilege('authenticated','public.day_logs','SELECT,INSERT,UPDATE,DELETE') AS day_log_crud,
      NOT has_table_privilege('anon','public.patients','SELECT') AS anon_patient_isolated
  `);

  const privileges = privilegeCheck.rows[0];
  if (!privileges.anon_public_config || !privileges.patient_crud ||
      !privileges.day_log_crud || !privileges.anon_patient_isolated) {
    throw new Error(`Baseline privilege check failed: ${JSON.stringify(privileges)}`);
  }

  const securityDefinerCheck = await db.query(`
    SELECT count(*)::int AS unsafe
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private')
      AND p.prokind='f'
      AND p.prosecdef
      AND NOT coalesce(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
  `);

  if (securityDefinerCheck.rows[0].unsafe !== 0) {
    throw new Error(`Found ${securityDefinerCheck.rows[0].unsafe} SECURITY DEFINER routines without an empty search_path`);
  }

  console.log('PASS: canonical Production baseline rebuilds in an isolated PostgreSQL engine.');
  console.log(`Verified: ${Object.entries(actual).map(([key,value])=>`${key}=${value}`).join(', ')}`);
  console.log('Verified least-privilege table grants and SECURITY DEFINER search_path protections.');
  console.log('Supabase-managed Auth/Vault objects and Realtime publication were stubbed/skipped for this isolated syntax/runtime test.');
} finally {
  await db.close();
}
