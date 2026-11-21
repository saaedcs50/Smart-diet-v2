// Shared restore verification checks (C1). Used by BOTH:
//   - smoke-pglite.mjs (local PGlite drill, no Docker)
//   - verify-schema.mjs (GitHub Actions, real Supabase local stack via pg)
// A check is { name, sql, expect }: sql returns one row; for a scalar expect the
// value comes from the row's `v` column; for an object expect each key is
// compared against the row's column of the same name. Counts reuse the
// validator's queries verbatim (scripts/validate-production-baseline.mjs).
// Expected values come from docs/migration-reconciliation-2026-11-21.md §6.3
// (drill results) and the Production baseline validator (11/40/23/19/2/11/33).

const COUNT_SQL = `
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')) AS tables,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public') AS policies,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public') AS indexes,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'private') AND p.prokind = 'f') AS routines,
    (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS triggers,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity) AS rls_tables,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND c.contype IN ('p', 'u', 'f', 'c', 'x')) AS constraints
`;

const PRIVILEGE_SQL = `
  SELECT
    has_table_privilege('anon', 'public.platform_config', 'SELECT') AS anon_public_config,
    has_table_privilege('authenticated', 'public.patients', 'SELECT,INSERT,UPDATE,DELETE') AS patient_crud,
    has_table_privilege('authenticated', 'public.day_logs', 'SELECT,INSERT,UPDATE,DELETE') AS day_log_crud,
    NOT has_table_privilege('anon', 'public.patients', 'SELECT') AS anon_patient_isolated
`;

const DEFINER_SQL = `
  SELECT count(*)::int AS v
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private')
    AND p.prokind = 'f'
    AND p.prosecdef
    AND NOT coalesce(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
`;

const TAGS_SQL = `
  SELECT (data_type = 'jsonb' AND is_nullable = 'NO'
    AND column_default = '''[]''::jsonb') AS v
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'tags'
`;

const DUPLICATES_SQL = `
  SELECT count(*)::int AS v FROM pg_indexes
  WHERE schemaname = 'public' AND indexname IN (
    'idx_adherence_scores_patient', 'idx_patients_clinic', 'idx_patients_invited_by')
`;

function tableExists(table) {
  return `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}') AS v`;
}
function indexExists(index) {
  return `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = '${index}') AS v`;
}
function constraintExists(name) {
  return `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') AS v`;
}

export function checksFor(chain) {
  const common = [
    { name: 'privileges', sql: PRIVILEGE_SQL, expect: { anon_public_config: true, patient_crud: true, day_log_crud: true, anon_patient_isolated: true } },
    { name: 'unsafe_security_definer_count', sql: DEFINER_SQL, expect: 0 },
    { name: 'patients_tags_column', sql: TAGS_SQL, expect: true },
    { name: 'patients_tags_valid_constraint', sql: constraintExists('patients_tags_valid'), expect: true },
    { name: 'duplicate_indexes_absent', sql: DUPLICATES_SQL, expect: 0 },
    { name: 'fcm_tokens_absent', sql: tableExists('fcm_tokens'), expect: false },
    { name: 'claim_push_subscription_is_invoker', sql: `SELECT NOT prosecdef AS v FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'claim_push_subscription'`, expect: true },
    { name: 'can_access_patient_both_schemas', sql: `SELECT count(*)::int AS v FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'private') AND p.proname = 'can_access_patient'`, expect: 2 },
    { name: 'idx_day_logs_patient_present', sql: indexExists('idx_day_logs_patient'), expect: true },
    // NOTE: the supabase_realtime publication check is NOT here — PGlite has no
    // supabase_realtime publication (the migration DO-block no-ops when it is
    // absent), so it belongs to test-services.mjs on the real local stack.
  ];

  if (chain === 'production') {
    return [
      { name: 'counts', sql: COUNT_SQL, expect: { tables: 11, policies: 40, indexes: 23, routines: 19, triggers: 2, rls_tables: 11, constraints: 33 } },
      ...common,
      { name: 'appointments_absent', sql: tableExists('appointments'), expect: false },
      { name: 'day_logs_key_present', sql: constraintExists('day_logs_patient_id_log_date_key'), expect: true },
      { name: 'day_logs_uidx_absent', sql: indexExists('day_logs_patient_id_log_date_uidx'), expect: false },
      { name: 'idx_consents_patient_present', sql: indexExists('idx_consents_patient'), expect: true },
      { name: 'push_check_excludes_fcm', sql: `SELECT (pg_get_constraintdef(oid) NOT LIKE '%fcm%googleapis%') AS v FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_https'`, expect: true },
      { name: 'adherence_overall_check_legacy_name', sql: constraintExists('adherence_scores_overall_range'), expect: true },
      { name: 'staging_only_fks_absent', sql: `SELECT count(*)::int AS v FROM pg_constraint WHERE conname IN ('adherence_configs_updated_by_fkey', 'adherence_scores_entered_by_fkey', 'consents_granted_by_fkey')`, expect: 0 },
      { name: 'consents_unique_legacy_name', sql: constraintExists('consents_patient_id_purpose_key'), expect: true },
    ];
  }

  // staging
  return [
    // counts: drill §6.3 (12 tables / 43 policies / 20 routines) — EXCEPT
    // triggers: the drill says 3, but the chain files create only 2
    // (clinic_subscription_payment_append_guard + appointments_validate_booking).
    // trg_invitation_consume is created ONLY by the production alignment file;
    // the staging reconciliation file creates the enforce function but no
    // trigger. The drill's "3" is most plausibly a 2+1 assumption error (prod's
    // 2 + appointments), not a measured value. This test asserts what the
    // documented chain produces (2) and records the discrepancy in the doc;
    // whether live staging has the trigger via manual provisioning is an open
    // question answerable by one read-only query (no functional impact — the
    // invitations RLS policy enforces the same transition rules).
    // indexes 27 and constraints 44 are derived from the production baseline
    // counts (23 / 33) plus the staging deltas (appointments table + 4 indexes
    // + 5 constraints, uidx +1, _key -1, idx_consents_patient -1, staging FKs +3,
    // appointments FKs +4) — the smoke test confirms or refutes them.
    { name: 'counts', sql: COUNT_SQL, expect: { tables: 12, policies: 43, indexes: 27, routines: 20, triggers: 2, rls_tables: 12, constraints: 44 } },
    ...common,
    { name: 'consents_updated_at_present', sql: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'consents' AND column_name = 'updated_at') AS v`, expect: true },
    { name: 'adherence_note_not_null_default', sql: `SELECT (is_nullable = 'NO' AND column_default = '''''::text') AS v FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'adherence_scores' AND column_name = 'note'`, expect: true },
    { name: 'day_logs_id_is_identity', sql: `SELECT (is_identity = 'YES') AS v FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'day_logs' AND column_name = 'id'`, expect: true },
    { name: 'consents_patient_purpose_key_present', sql: constraintExists('consents_patient_purpose_key'), expect: true },
    { name: 'day_logs_uidx_present', sql: indexExists('day_logs_patient_id_log_date_uidx'), expect: true },
    { name: 'day_logs_key_absent', sql: constraintExists('day_logs_patient_id_log_date_key'), expect: false },
    { name: 'push_check_allows_fcm', sql: `SELECT (pg_get_constraintdef(oid) LIKE '%fcm%googleapis%') AS v FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_https'`, expect: true },
    { name: 'appointments_present', sql: tableExists('appointments'), expect: true },
    { name: 'appointments_policy_count', sql: `SELECT count(*)::int AS v FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'`, expect: 3 },
    { name: 'validate_appointment_booking_present', sql: `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' AND p.proname = 'validate_appointment_booking') AS v`, expect: true },
    { name: 'appointments_trigger_present', sql: `SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'appointments_validate_booking' AND NOT tgisinternal) AS v`, expect: true },
    { name: 'appointments_created_by_idx_present', sql: indexExists('appointments_created_by_idx'), expect: true },
    { name: 'staging_fks_present', sql: `SELECT count(*)::int AS v FROM pg_constraint WHERE conname IN ('adherence_configs_updated_by_fkey', 'adherence_scores_entered_by_fkey', 'consents_granted_by_fkey')`, expect: 3 },
    { name: 'adherence_overall_check_auto_name', sql: constraintExists('adherence_scores_overall_check'), expect: true },
    { name: 'idx_consents_patient_absent', sql: indexExists('idx_consents_patient'), expect: false },
  ];
}

// Runs a check list against a query function `q(sql) -> { rows }`.
// Returns { passed, failed, failures: [{name, expected, actual}] }.
export async function runChecks(q, chain) {
  const checks = checksFor(chain);
  let passed = 0;
  const failures = [];
  for (const check of checks) {
    const { rows } = await q(check.sql);
    if (rows.length === 0) {
      failures.push({ name: check.name, expected: check.expect, actual: '<no rows>' });
      console.log(`FAIL ${check.name}: query returned no rows (expected ${JSON.stringify(check.expect)})`);
      continue;
    }
    const row = rows[0];
    if (check.expect !== null && typeof check.expect === 'object') {
      const bad = Object.entries(check.expect).filter(([k, v]) => row[k] !== v);
      if (bad.length === 0) {
        passed++;
        console.log(`PASS ${check.name}: ${Object.entries(check.expect).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      } else {
        failures.push({ name: check.name, expected: check.expect, actual: row });
        console.log(`FAIL ${check.name}: expected ${JSON.stringify(check.expect)}, got ${JSON.stringify(row)}`);
      }
    } else if (row.v === check.expect) {
      passed++;
      console.log(`PASS ${check.name}: ${JSON.stringify(row.v)}`);
    } else {
      failures.push({ name: check.name, expected: check.expect, actual: row.v });
      console.log(`FAIL ${check.name}: expected ${JSON.stringify(check.expect)}, got ${JSON.stringify(row.v)}`);
    }
  }
  return { passed, failed: failures.length, failures };
}
