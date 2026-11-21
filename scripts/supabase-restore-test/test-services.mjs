// Supabase services tests for the C1 restore test (C1).
// Runs against the Supabase local stack started by the GitHub Actions workflow
// — these are the services the PGlite drill could NOT test (it stubs them).
//
// Usage (env vars come from `supabase status -o json` in the workflow):
//   SUPABASE_URL=http://localhost:54321 \
//   SUPABASE_ANON_KEY=<local anon key> \
//   SUPABASE_SERVICE_ROLE_KEY=<local service_role key> \
//   node scripts/supabase-restore-test/test-services.mjs --chain staging
//
// The local keys are the CLI's well-known development defaults for a throwaway
// local stack, not real secrets — but they are still never printed.
// All data is synthetic (restore-test accounts in a throwaway database).
//
// Tests:
//   1. Realtime publication contains public.profiles (added by the migration
//      DO-block — it no-ops when the publication does not exist, so this also
//      proves the stack created the publication).
//   2. Auth: create two users via the GoTrue Admin API, sign in with each,
//      and prove RLS isolation over PostgREST (each user reads only their own
//      profile row; anon reads none).
//   3. Realtime: a live postgres_changes subscription delivers a profile
//      update to the owning user and NOT to the other user (RLS-filtered).
//   4. Vault: create + read back a secret; confirm get_push_signing_config
//      exists (its three VAPID secrets are project configuration, not
//      restorable from the repo — the baseline header says so explicitly).
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const chainIdx = args.indexOf('--chain');
const chain = chainIdx === -1 ? undefined : args[chainIdx + 1];
if (!['production', 'staging'].includes(chain)) {
  console.error('usage: test-services.mjs --chain production|staging');
  process.exit(2);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgres://postgres:postgres@localhost:54322/postgres';
if (!ANON_KEY || !SERVICE_KEY) {
  console.error('SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(2);
}

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`);
}
function fail(name, detail) {
  results.push({ name, ok: false });
  console.log(`FAIL ${name}: ${detail}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const suffix = randomBytes(4).toString('hex');
const emailA = `restore-a-${suffix}@staging.test`;
const emailB = `restore-b-${suffix}@staging.test`;
const password = `Restore-Test-${randomBytes(12).toString('hex')}`;

const pgClient = new pg.Client({ connectionString: DB_URL });
await pgClient.connect();
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  // 1. Realtime publication -------------------------------------------------
  {
    const { rows } = await pgClient.query(
      `SELECT EXISTS (SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = 'profiles') AS v`,
    );
    if (rows[0].v) pass('realtime_publication_has_profiles');
    else fail('realtime_publication_has_profiles', 'public.profiles not in supabase_realtime');
  }

  // 2. Auth + RLS isolation over PostgREST ----------------------------------
  let userA;
  let userB;
  {
    const { data: a, error: errA } = await admin.auth.admin.createUser({
      email: emailA, password, email_confirm: true,
    });
    const { data: b, error: errB } = await admin.auth.admin.createUser({
      email: emailB, password, email_confirm: true,
    });
    if (errA || errB || !a.user || !b.user) {
      fail('auth_admin_create_users', `A: ${errA?.message ?? 'ok'}; B: ${errB?.message ?? 'ok'}`);
      throw new Error('cannot create test users');
    }
    userA = a.user;
    userB = b.user;
    pass('auth_admin_create_users', '2 users created via GoTrue Admin API');
  }

  // Profile rows (inserted as postgres, bypassing RLS — the app inserts them
  // through the invitation flow; here we only need rows to test reads).
  await pgClient.query(
    `INSERT INTO public.profiles (id, role, clinic_id, email, display_name)
     VALUES ($1, 'patient', 'clinic-a', $2, 'Restore Test A'),
            ($3, 'patient', 'clinic-b', $4, 'Restore Test B')`,
    [userA.id, emailA, userB.id, emailB],
  );

  const clientA = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clientB = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  {
    const { error: errA } = await clientA.auth.signInWithPassword({ email: emailA, password });
    const { error: errB } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (errA || errB) {
      fail('auth_password_sign_in', `A: ${errA?.message ?? 'ok'}; B: ${errB?.message ?? 'ok'}`);
      throw new Error('cannot sign in test users');
    }
    pass('auth_password_sign_in', 'both users signed in with email + password');
  }
  {
    const { data: rowsA, error: errA } = await clientA.from('profiles').select('id');
    const { data: rowsB, error: errB } = await clientB.from('profiles').select('id');
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: rowsAnon, error: errAnon } = await anon.from('profiles').select('id');
    const aOk = !errA && rowsA?.length === 1 && rowsA[0].id === userA.id;
    const bOk = !errB && rowsB?.length === 1 && rowsB[0].id === userB.id;
    const anonOk = (errAnon != null && (rowsAnon == null || rowsAnon.length === 0))
      || (rowsAnon != null && rowsAnon.length === 0);
    if (aOk && bOk) pass('rls_postgrest_isolation', 'each user reads only their own profile row');
    else fail('rls_postgrest_isolation', `A rows=${JSON.stringify(rowsA)} err=${errA?.message}; B rows=${JSON.stringify(rowsB)} err=${errB?.message}`);
    if (anonOk) pass('rls_anon_reads_nothing', 'anon sees no profile rows');
    else fail('rls_anon_reads_nothing', `anon rows=${JSON.stringify(rowsAnon)} err=${errAnon?.message}`);
  }

  // 3. Realtime live subscription -------------------------------------------
  {
    let eventA = null;
    let eventB = null;
    const channelA = clientA
      .channel('restore-test-a')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userA.id}` },
        (payload) => { eventA = payload; })
      .subscribe();
    const channelB = clientB
      .channel('restore-test-b')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userA.id}` },
        (payload) => { eventB = payload; })
      .subscribe();

    // Wait for both subscriptions (SUBSCRIBED) with a 20 s deadline.
    const subscribed = { a: false, b: false };
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && (!subscribed.a || !subscribed.b)) {
      if (channelA.state === 'joined') subscribed.a = true;
      if (channelB.state === 'joined') subscribed.b = true;
      if (!subscribed.a || !subscribed.b) await wait(500);
    }
    if (!subscribed.a || !subscribed.b) {
      fail('realtime_subscribe', `A joined=${subscribed.a} B joined=${subscribed.b}`);
    } else {
      pass('realtime_subscribe', 'both channels joined');
      // Two attempts: the first Realtime delivery after a cold start can be
      // slow (the managed preview showed the same first-run flake).
      for (let attempt = 1; attempt <= 2 && !eventA; attempt++) {
        await pgClient.query(
          `UPDATE public.profiles SET display_name = $1 WHERE id = $2`,
          [`Restore Test A (attempt ${attempt})`, userA.id],
        );
        const waitUntil = Date.now() + 15_000;
        while (Date.now() < waitUntil && !eventA) await wait(500);
      }
      // Give B a grace window to (incorrectly) receive the event, then judge.
      await wait(5_000);
      if (eventA?.new?.display_name?.startsWith('Restore Test A (attempt')) {
        pass('realtime_own_delivery', `owner received UPDATE (${eventA.new.display_name})`);
      } else {
        fail('realtime_own_delivery', 'owner received no UPDATE event within 2 attempts');
      }
      if (eventB == null) pass('realtime_cross_filtered', 'other user received no event for A’s row');
      else fail('realtime_cross_filtered', `other user wrongly received: ${JSON.stringify(eventB.new)}`);
    }
    await clientA.removeChannel(channelA);
    await clientB.removeChannel(channelB);
  }

  // 4. Vault ------------------------------------------------------------------
  {
    const secretName = `restore-test-${suffix}`;
    const secretValue = `c1-vault-check-${suffix}`;
    await pgClient.query(`SELECT vault.create_secret($1, $2)`, [secretValue, secretName]);
    const { rows } = await pgClient.query(
      `SELECT decrypted_secret AS v FROM vault.decrypted_secrets WHERE name = $1`,
      [secretName],
    );
    if (rows[0]?.v === secretValue) pass('vault_create_and_read', 'secret round-tripped via Vault');
    else fail('vault_create_and_read', `read back ${JSON.stringify(rows[0]?.v)}`);
    await pgClient.query(`SELECT vault.delete_secret($1)`, [secretName]);
  }
  {
    const { rows } = await pgClient.query(
      `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_push_signing_config') AS v`,
    );
    if (rows[0].v) {
      pass('push_signing_config_present', 'function exists; its 3 VAPID Vault secrets are project config, not repo content');
    } else {
      fail('push_signing_config_present', 'public.get_push_signing_config is missing');
    }
  }
} finally {
  await pgClient.end();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nservices: ${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) {
  console.error('SERVICES TESTS FAILED');
  process.exit(1);
}
console.log('SERVICES TESTS PASSED');
