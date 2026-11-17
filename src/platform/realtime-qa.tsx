import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

const enabled = import.meta.env.VITE_REALTIME_QA_ENABLED === 'true';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Credentials = { email: string; password: string };
type Profile = { id: string; clinic_id: string; role: string; display_name: string | null };
type Counts = { patientAOwn: number; patientACross: number; patientBOwn: number; patientBCross: number };
type Result = { passed: boolean; counts: Counts; clinics: [string, string]; message: string };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function makeClient(): SupabaseClient {
  if (!url || !key) throw new Error('Supabase Staging preview configuration is missing');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

async function signIn(client: SupabaseClient, credentials: Credentials): Promise<Profile> {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user) throw new Error(error?.message || 'Test account sign-in failed');
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,clinic_id,role,display_name')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile) throw new Error(profileError?.message || 'Could not read signed-in test profile');
  return profile as Profile;
}

async function subscribe(
  client: SupabaseClient,
  name: string,
  targetId: string,
  onEvent: () => void,
): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const channel = client
      .channel(name)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${targetId}` },
        () => onEvent(),
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED' && !settled) {
          settled = true;
          resolve(channel);
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
          settled = true;
          reject(new Error(error?.message || `Realtime subscription failed: ${status}`));
        }
      });
    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        void channel.unsubscribe();
        reject(new Error(`Timed out while subscribing to ${name}`));
      }
    }, 12000);
  });
}

async function runIsolationTest(a: Credentials, b: Credentials, owner: Credentials): Promise<Result> {
  const clientA = makeClient();
  const clientB = makeClient();
  const ownerClient = makeClient();
  const channels: RealtimeChannel[] = [];
  let profiles: Profile[] = [];
  let markersWritten = false;

  const counts: Counts = {
    patientAOwn: 0,
    patientACross: 0,
    patientBOwn: 0,
    patientBCross: 0,
  };

  try {
    const [profileA, profileB, ownerProfile] = await Promise.all([
      signIn(clientA, a),
      signIn(clientB, b),
      signIn(ownerClient, owner),
    ]);
    profiles = [profileA, profileB];

    if (profileA.role !== 'patient' || profileB.role !== 'patient') {
      throw new Error('The two isolation-test identities must both be patient accounts');
    }
    if (!profileA.clinic_id || !profileB.clinic_id || profileA.clinic_id === profileB.clinic_id) {
      throw new Error('The test identities must belong to two different clinics');
    }
    if (ownerProfile.role !== 'owner') throw new Error('The third test identity must be the Staging platform owner');

    const suffix = crypto.randomUUID();
    channels.push(
      await subscribe(clientA, `phase1-own-a-${suffix}`, profileA.id, () => { counts.patientAOwn += 1; }),
      await subscribe(clientA, `phase1-cross-a-${suffix}`, profileB.id, () => { counts.patientACross += 1; }),
      await subscribe(clientB, `phase1-own-b-${suffix}`, profileB.id, () => { counts.patientBOwn += 1; }),
      await subscribe(clientB, `phase1-cross-b-${suffix}`, profileA.id, () => { counts.patientBCross += 1; }),
    );

    const markerA = `phase1-rt-${suffix}-a`;
    const markerB = `phase1-rt-${suffix}-b`;

    const [touchA, touchB] = await Promise.all([
      ownerClient.from('profiles').update({ display_name: markerA }).eq('id', profileA.id).select('id'),
      ownerClient.from('profiles').update({ display_name: markerB }).eq('id', profileB.id).select('id'),
    ]);
    if (touchA.error) throw new Error(`Could not generate Staging event for clinic A: ${touchA.error.message}`);
    if (touchB.error) throw new Error(`Could not generate Staging event for clinic B: ${touchB.error.message}`);
    if (touchA.data?.length !== 1 || touchB.data?.length !== 1) {
      throw new Error('Owner test account did not update exactly the two synthetic Staging profiles');
    }
    markersWritten = true;

    // Allow the authenticated WebSocket subscriptions to receive the Postgres changes.
    await wait(2500);

    const passed =
      counts.patientAOwn > 0 &&
      counts.patientBOwn > 0 &&
      counts.patientACross === 0 &&
      counts.patientBCross === 0;

    return {
      passed,
      counts: { ...counts },
      clinics: [profileA.clinic_id, profileB.clinic_id],
      message: passed
        ? 'Both patients received their own profile update; neither received the other clinic profile update.'
        : 'Realtime delivery or cross-clinic isolation did not match the expected result.',
    };
  } finally {
    if (markersWritten && profiles.length === 2) {
      // Restore the original values of the two synthetic Staging profiles.
      await Promise.all([
        ownerClient.from('profiles').update({ display_name: profiles[0].display_name }).eq('id', profiles[0].id),
        ownerClient.from('profiles').update({ display_name: profiles[1].display_name }).eq('id', profiles[1].id),
      ]);
    }
    await Promise.all(channels.map((channel) => channel.unsubscribe()));
    await Promise.all([
      clientA.auth.signOut(),
      clientB.auth.signOut(),
      ownerClient.auth.signOut(),
    ]);
    await Promise.all([
      clientA.removeAllChannels(),
      clientB.removeAllChannels(),
      ownerClient.removeAllChannels(),
    ]);
  }
}

function App() {
  const [emailA, setEmailA] = useState('patienta@staging.test');
  const [passwordA, setPasswordA] = useState('');
  const [emailB, setEmailB] = useState('patientb@staging.test');
  const [passwordB, setPasswordB] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('owner@staging.test');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready. Use only the disposable Staging identities.');
  const [result, setResult] = useState<Result | null>(null);

  if (!enabled || !url || !key) {
    return <main><h1>Realtime QA unavailable</h1><p>This test route is disabled for this deployment.</p></main>;
  }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setMessage('Signing in three Staging test identities and subscribing to Realtime...');
    try {
      const report = await runIsolationTest(
        { email: emailA.trim(), password: passwordA },
        { email: emailB.trim(), password: passwordB },
        { email: ownerEmail.trim(), password: ownerPassword },
      );
      setResult(report);
      setMessage(report.passed ? 'PASS — cross-clinic Realtime isolation verified.' : 'FAIL — see event counts below.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unknown Realtime QA failure');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '32px auto', padding: 24, fontFamily: 'system-ui,sans-serif', color: '#18212f' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Smart Diet — Staging Realtime Isolation QA</h1>
      <p>This temporary test uses only disposable Staging identities in two separate clinics. Passwords are used in memory for this page and are never stored or displayed.</p>
      <form onSubmit={start} style={{ display: 'grid', gap: 14 }}>
        <fieldset style={{ border: '1px solid #cbd5e1', padding: 16 }}>
          <legend>Patient A — Clinic A</legend>
          <label>Email <input required type="email" value={emailA} onChange={(e) => setEmailA(e.target.value)} /></label>
          <label>Password <input required type="password" autoComplete="off" value={passwordA} onChange={(e) => setPasswordA(e.target.value)} /></label>
        </fieldset>
        <fieldset style={{ border: '1px solid #cbd5e1', padding: 16 }}>
          <legend>Patient B — Clinic B</legend>
          <label>Email <input required type="email" value={emailB} onChange={(e) => setEmailB(e.target.value)} /></label>
          <label>Password <input required type="password" autoComplete="off" value={passwordB} onChange={(e) => setPasswordB(e.target.value)} /></label>
        </fieldset>
        <fieldset style={{ border: '1px solid #cbd5e1', padding: 16 }}>
          <legend>Staging platform owner — event generator</legend>
          <label>Email <input required type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></label>
          <label>Password <input required type="password" autoComplete="off" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} /></label>
        </fieldset>
        <button type="submit" disabled={busy} style={{ padding: '12px 18px', borderRadius: 8, background: '#1d4ed8', color: 'white', fontWeight: 700 }}>
          {busy ? 'Testing...' : 'Run two-clinic Realtime test'}
        </button>
      </form>
      <section aria-live="polite" style={{ marginTop: 24, padding: 16, border: '1px solid #cbd5e1', borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Test status</h2>
        <p>{message}</p>
        {result && (
          <>
            <p>Clinic A: <strong>{result.clinics[0]}</strong> · Clinic B: <strong>{result.clinics[1]}</strong></p>
            <p>{result.message}</p>
            <table>
              <tbody>
                <tr><th>Patient A receives own update</th><td>{result.counts.patientAOwn}</td></tr>
                <tr><th>Patient A receives Clinic B update</th><td>{result.counts.patientACross}</td></tr>
                <tr><th>Patient B receives own update</th><td>{result.counts.patientBOwn}</td></tr>
                <tr><th>Patient B receives Clinic A update</th><td>{result.counts.patientBCross}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
