import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const requiredTables = [
  'profiles',
  'clinics',
  'clinic_subscriptions',
  'platform_config',
  'invitations',
  'patients',
  'day_logs',
  'adherence_configs',
  'adherence_scores',
  'push_subscriptions',
  'consents',
];

const migrationDir = path.resolve('supabase/migrations');
const migrationFiles = (await readdir(migrationDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const migrations = await Promise.all(
  migrationFiles.map((name) => readFile(path.join(migrationDir, name), 'utf8')),
);
const allSql = migrations.join('\n');

// Keep migration filenames canonical and aligned with the Staging ledger.
const versionedMigrations = migrationFiles
  .map((name) => ({ name, match: name.match(/^(\d{14})_[a-z0-9_]+\.sql$/) }));
const invalidMigrationNames = versionedMigrations
  .filter(({ match }) => !match)
  .map(({ name }) => name);
const versionCounts = new Map();
for (const { name, match } of versionedMigrations) {
  if (!match) continue;
  versionCounts.set(match[1], [...(versionCounts.get(match[1]) ?? []), name]);
}
const duplicateMigrationVersions = [...versionCounts.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([version, names]) => version + ': ' + names.join(', '));

// Required canonical repository source files. These filenames are not a
// comparison against the live Production or Staging version identifiers;
// the per-project deployed ledgers are audited separately.
const requiredMigrationSources = [
  '20261109061815_staging_schema_reconciliation.sql',
  '20261109062015_performance_policy_tuning.sql',
  '20261109063122_owner_atomic_operations.sql',
  '20261109063451_owner_rpc_argument_validation.sql',
  '20261109063920_owner_rpc_security_invoker.sql',
  '20261109072358_profiles_admin_only_visibility.sql',
  '20261109072730_explicit_rls_all_platform_tables.sql',
  '20261109073443_consolidate_clinic_subscription_policies.sql',
  '20261109073735_restrict_remaining_public_policies.sql',
  '20261109074419_consolidate_remaining_rls_policies.sql',
  '20261109074506_split_platform_config_read.sql',
  '20261117140700_replace_legacy_push_tokens.sql',
  '20261117150000_harden_push_subscription_registration.sql',
];
const missingMigrationSources = requiredMigrationSources
  .filter((name) => !migrationFiles.includes(name));
// Include additive migrations so newly introduced tables are checked too.
const rlsManifest = allSql;

const policyStatements = [...allSql.matchAll(/CREATE\s+POLICY\b[\s\S]*?;/gi)]
  .map((match) => match[0]);

const failures = [];
for (const name of invalidMigrationNames) {
  failures.push(name + ': migration filename must be YYYYMMDDHHMMSS_description.sql');
}
for (const duplicate of duplicateMigrationVersions) {
  failures.push('duplicate migration version: ' + duplicate);
}
for (const name of missingMigrationSources) {
  failures.push(name + ': required migration source file is missing from the repository');
}
for (const table of requiredTables) {
  const rlsPattern = new RegExp(
    'ALTER\\s+TABLE\\s+public\\.' + table + '\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY',
    'i',
  );
  if (!rlsPattern.test(rlsManifest)) {
    failures.push(table + ': explicit ENABLE ROW LEVEL SECURITY statement missing');
  }

  const policyPattern = new RegExp('\\bON\\s+public\\.' + table + '\\b', 'i');
  if (!policyStatements.some((statement) => policyPattern.test(statement))) {
    failures.push(table + ': no CREATE POLICY statement found in migrations');
  }
}

if (failures.length > 0) {
  console.error('Supabase RLS static validation failed:');
  for (const failure of failures) console.error(' - ' + failure);
  process.exitCode = 1;
} else {
  console.log('Supabase RLS static validation passed for ' + requiredTables.length +
    ' tables across ' + migrationFiles.length + ' migrations.');
}
