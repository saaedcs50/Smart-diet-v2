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
  'fcm_tokens',
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

// These versions were confirmed in the active Staging migration history.
// Keep this snapshot in sync whenever a Staging migration is intentionally applied.
const expectedStagingMigrations = [
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
];
const missingStagingMigrations = expectedStagingMigrations
  .filter((name) => !migrationFiles.includes(name));
const rlsManifest = await readFile(
  path.join(migrationDir, '20261109072730_explicit_rls_all_platform_tables.sql'),
  'utf8',
);

const policyStatements = [...allSql.matchAll(/CREATE\s+POLICY\b[\s\S]*?;/gi)]
  .map((match) => match[0]);

const failures = [];
for (const name of invalidMigrationNames) {
  failures.push(name + ': migration filename must be YYYYMMDDHHMMSS_description.sql');
}
for (const duplicate of duplicateMigrationVersions) {
  failures.push('duplicate migration version: ' + duplicate);
}
for (const name of missingStagingMigrations) {
  failures.push(name + ': Staging ledger migration is missing from the repository');
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
