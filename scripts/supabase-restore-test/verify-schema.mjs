// Verifies a restored schema on a live PostgreSQL database (C1).
// Used by the GitHub Actions restore workflow against the Supabase local stack.
// Usage:
//   node scripts/supabase-restore-test/verify-schema.mjs --chain production
//   [--db-url postgres://postgres:postgres@localhost:54322/postgres]
//
// Requires the `pg` package (the workflow installs it with
// `npm install --no-save --package-lock=false pg`).
// The checks are the shared definitions in checks.mjs — the same checks the
// PGlite smoke test runs, so a local pass and a stack pass mean the same thing.
import pg from 'pg';
import { runChecks } from './checks.mjs';

const args = process.argv.slice(2);
const chainIdx = args.indexOf('--chain');
const chain = chainIdx === -1 ? undefined : args[chainIdx + 1];
const dbUrlIdx = args.indexOf('--db-url');
const dbUrl = dbUrlIdx === -1
  ? 'postgres://postgres:postgres@localhost:54322/postgres'
  : args[dbUrlIdx + 1];
if (!['production', 'staging'].includes(chain)) {
  console.error('usage: verify-schema.mjs --chain production|staging [--db-url <url>]');
  process.exit(2);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
console.log(`connected to ${dbUrl.replace(/:[^:@/]+@/, ':***@')}`);
try {
  const { rows } = await client.query('SELECT version() AS v');
  console.log(`server: ${rows[0].v.split(' ').slice(0, 2).join(' ')}`);
  const { passed, failed } = await runChecks((sql) => client.query(sql), chain);
  console.log(`\nchain ${chain}: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('SCHEMA VERIFICATION FAILED');
    process.exit(1);
  }
  console.log('SCHEMA VERIFICATION PASSED');
} finally {
  await client.end();
}
