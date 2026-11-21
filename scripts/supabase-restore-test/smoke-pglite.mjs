// C1 restore smoke test — local PGlite drill (no Docker, no Supabase CLI).
// Reconstructs the PROMPT 4 clean-room drill (docs/migration-reconciliation-
// 2026-11-21.md §6) as a committed script (closure report O14: any future drill
// must be built as a committed script under scripts/, not in /tmp).
//
// Usage (from the repo root):
//   node scripts/supabase-restore-test/smoke-pglite.mjs --chain production
//   node scripts/supabase-restore-test/smoke-pglite.mjs --chain staging
//   node scripts/supabase-restore-test/smoke-pglite.mjs --chain both
//
// Requires @electric-sql/pglite (installed by the baseline workflow with
// `npm install --no-save --package-lock=false @electric-sql/pglite@0.5.16`).
// Branch files (PR #71/#75/#76) are read with `git show` from their branches;
// the script fetches the branch ref first if it is not present locally.
// No network access to Supabase and no writes to any live database.
//
// What this proves: the seed + migration chain apply cleanly in real
// PostgreSQL 17 and the end state matches the expected counts/objects.
// What it does NOT prove (see the GitHub Actions workflow for those):
// real Auth (GoTrue), Realtime (live subscription), Vault, or the
// supabase_realtime publication (absent in PGlite — the migration DO-block
// that adds public.profiles to it no-ops here by design).
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { runChecks } from './checks.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const CHAINS = JSON.parse(
  await readFile(new URL('./chains.json', import.meta.url), 'utf8'),
);

// Same preamble as scripts/validate-production-baseline.mjs: stub only the
// Supabase-owned catalog dependencies (roles, auth.users, Vault, auth helpers).
const PREAMBLE = `
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
`;

// The validator strips CREATE EXTENSION lines (they need the managed control
// plane); do the same here — the seed's pgcrypto line is a no-op in PGlite
// (gen_random_uuid() is core in PostgreSQL 13+).
function stripExtensions(sql) {
  return sql.replace(/^CREATE EXTENSION IF NOT EXISTS .*;\s*$/gm, '');
}

function gitShow(branch, path) {
  try {
    execSync(`git rev-parse --verify --quiet refs/remotes/origin/${branch}`, {
      cwd: ROOT,
      stdio: 'ignore',
    });
  } catch {
    console.log(`fetching branch ${branch} ...`);
    execSync(`git fetch origin ${branch}`, { cwd: ROOT, stdio: 'ignore' });
  }
  return execSync(`git show origin/${branch}:${path}`, { cwd: ROOT, encoding: 'utf8' });
}

async function runChain(chain) {
  console.log(`\n===== chain: ${chain} =====`);
  const db = new PGlite();
  try {
    await db.exec(PREAMBLE);
    const seed = await readFile(
      new URL(`./seed-${chain}.sql`, import.meta.url),
      'utf8',
    );
    console.log('applying seed ...');
    await db.exec(stripExtensions(seed));
    console.log('seed applied.');

    for (const entry of CHAINS[chain]) {
      const sql =
        entry.source === 'main'
          ? await readFile(
              new URL(`../../supabase/migrations/${entry.file}`, import.meta.url),
              'utf8',
            )
          : gitShow(entry.branch, `supabase/migrations/${entry.file}`);
      console.log(`applying ${entry.file} ...`);
      await db.exec(sql);
    }
    console.log(`all ${CHAINS[chain].length} chain files applied.`);

    const { passed, failed } = await runChecks((sql) => db.query(sql), chain);
    console.log(`\nchain ${chain}: ${passed} passed, ${failed} failed`);
    return failed === 0;
  } finally {
    await db.close();
  }
}

const chainIdx = process.argv.indexOf('--chain');
const arg = process.argv.find((a) => a.startsWith('--chain='))?.slice('--chain='.length)
  ?? (chainIdx === -1 ? 'both' : process.argv[chainIdx + 1]);
const chains = arg === 'both' ? ['production', 'staging'] : [arg];
if (!chains.every((c) => c === 'production' || c === 'staging')) {
  console.error('usage: --chain production|staging|both');
  process.exit(2);
}

let ok = true;
for (const chain of chains) {
  ok = (await runChain(chain)) && ok;
}
if (!ok) {
  console.error('\nSMOKE TEST FAILED');
  process.exit(1);
}
console.log('\nSMOKE TEST PASSED');
