// Builds the throwaway Supabase CLI workdir for one restore chain (C1).
// Usage (from the repo root):
//   node scripts/supabase-restore-test/build-workdir.mjs --chain production --workdir /tmp/restore-production
//
// What it does:
//   1. Runs `supabase init` in the workdir (non-interactive; generates a
//      default config.toml pinned to PostgreSQL 17, matching the live projects).
//   2. Copies the chain's migration files (chains.json order) into
//      supabase/migrations/ — main files from the repo, branch files
//      (PR #71/#75/#76) via `git show` from their branches. Branch files are
//      NEVER copied into the repo's own supabase/migrations/.
//   3. Copies the chain seed to supabase/migrations/20260101000000_restore_seed.sql
//      so the CLI applies it first (timestamp order).
//   4. Sets auto_expose_new_tables = false in the generated config: with the
//      default (true) the CLI grants the Data API roles access to new tables
//      automatically, which would hide missing GRANTs; false makes every grant
//      come from the seed/migrations, exactly like the PGlite drill.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const chain = args[args.indexOf('--chain') + 1];
const workdir = args[args.indexOf('--workdir') + 1];
if (!['production', 'staging'].includes(chain) || !workdir) {
  console.error('usage: build-workdir.mjs --chain production|staging --workdir <dir>');
  process.exit(2);
}

const ROOT = new URL('../..', import.meta.url).pathname;
const CHAINS = JSON.parse(
  readFileSync(new URL('./chains.json', import.meta.url), 'utf8'),
);
const HERE = new URL('.', import.meta.url).pathname;

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

mkdirSync(workdir, { recursive: true });
try {
  const version = execSync('supabase --version', { encoding: 'utf8' }).trim();
  console.log(`supabase CLI: ${version}`);
} catch {
  console.error('ERROR: `supabase` is not on PATH. In CI it comes from supabase/setup-cli@v3;');
  console.error('locally, install the CLI (https://supabase.com/docs/guides/cli) first.');
  process.exit(2);
}
console.log(`supabase init in ${workdir} ...`);
execSync('supabase init', { cwd: workdir, stdio: 'inherit' });

const migrationsDir = join(workdir, 'supabase', 'migrations');
mkdirSync(migrationsDir, { recursive: true });

// Seed first (earliest timestamp sorts before every chain file).
copyFileSync(
  join(HERE, `seed-${chain}.sql`),
  join(migrationsDir, '20260101000000_restore_seed.sql'),
);
console.log('seed -> 20260101000000_restore_seed.sql');

for (const entry of CHAINS[chain]) {
  const dest = join(migrationsDir, entry.file);
  if (entry.source === 'main') {
    copyFileSync(join(ROOT, 'supabase', 'migrations', entry.file), dest);
  } else {
    writeFileSync(dest, gitShow(entry.branch, `supabase/migrations/${entry.file}`));
  }
  console.log(`${entry.file} (${entry.source}${entry.pr ? ` PR #${entry.pr}` : ''})`);
}

// auto_expose_new_tables = false: every grant must come from the seed/files.
const configPath = join(workdir, 'supabase', 'config.toml');
let config = readFileSync(configPath, 'utf8');
if (/^# auto_expose_new_tables = true/m.test(config)) {
  config = config.replace(
    /^# auto_expose_new_tables = true/m,
    'auto_expose_new_tables = false',
  );
} else if (!/^auto_expose_new_tables/m.test(config)) {
  config = config.replace(/^\[api\]/m, '[api]\nauto_expose_new_tables = false');
}
writeFileSync(configPath, config);
console.log('config: auto_expose_new_tables = false');

if (!existsSync(join(workdir, 'supabase', 'config.toml'))) {
  throw new Error('config.toml missing after supabase init');
}
console.log(`workdir ready: ${workdir} (${CHAINS[chain].length + 1} migration files)`);
