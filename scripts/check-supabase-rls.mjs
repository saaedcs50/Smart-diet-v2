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
const rlsManifest = await readFile(
  path.join(migrationDir, '20261109080015_explicit_rls_all_platform_tables.sql'),
  'utf8',
);

const policyStatements = [...allSql.matchAll(/CREATE\\s+POLICY\\b[\\s\\S]*?;/gi)]
  .map((match) => match[0]);

const failures = [];
for (const table of requiredTables) {
  const rlsPattern = new RegExp(
    `ALTER\\\\s+TABLE\\\\s+public\\\\.${table}\\\\s+ENABLE\\\\s+ROW\\\\s+LEVEL\\\\s+SECURITY`,
    'i',
  );
  if (!rlsPattern.test(rlsManifest)) {
    failures.push(`${table}: explicit ENABLE ROW LEVEL SECURITY statement missing`);
  }

  const policyPattern = new RegExp(`\\\\bON\\\\s+public\\\\.${table}\\\\b`, 'i');
  if (!policyStatements.some((statement) => policyPattern.test(statement))) {
    failures.push(`${table}: no CREATE POLICY statement found in migrations`);
  }
}

if (failures.length > 0) {
  console.error('Supabase RLS static validation failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Supabase RLS static validation passed for ${requiredTables.length} tables across ${migrationFiles.length} migrations.`);
}
