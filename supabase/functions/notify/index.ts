// Supabase Edge Function: deliver empty-payload Web Push notifications.
// No patient name, clinical text, or health data is sent to a push provider.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createVapidAuthorization(audience: string): Promise<string> {
  const privateKey = base64UrlDecode(VAPID_PRIVATE_KEY);
  if (privateKey.length !== 32) throw new Error('Invalid VAPID private key.');

  const pkcs8Header = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
    0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + privateKey.length);
  pkcs8.set(pkcs8Header);
  pkcs8.set(privateKey, pkcs8Header.length);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  })));
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  ));
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${VAPID_PUBLIC_KEY}`;
}

function isApprovedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com' ||
      host === 'updates.push.services.mozilla.com' ||
      host === 'web.push.apple.com' ||
      host.endsWith('.notify.windows.com');
  } catch {
    return false;
  }
}

async function sendEmptyPush(endpoint: string): Promise<'sent' | 'expired' | 'failed'> {
  if (!isApprovedPushEndpoint(endpoint)) return 'failed';
  const url = new URL(endpoint);
  const authorization = await createVapidAuthorization(`${url.protocol}//${url.host}`);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        TTL: '60',
        Urgency: 'normal',
      },
    });
    if (response.status === 404 || response.status === 410) return 'expired';
    return response.status === 201 || response.status === 202 || response.status === 200
      ? 'sent'
      : 'failed';
  } catch {
    return 'failed';
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY ||
      !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return json({ ok: false, error: 'Push delivery is not configured.' }, 503);
  }

  try {
    const authorization = request.headers.get('Authorization') ?? '';
    const accessToken = authorization.replace(/^Bearer\\s+/i, '');
    if (!accessToken) return json({ ok: false, error: 'غير مصرح.' }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user) return json({ ok: false, error: 'جلسة الدخول غير صالحة.' }, 401);

    const input = await request.json().catch(() => null) as { patientUid?: unknown } | null;
    if (!input || typeof input.patientUid !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.patientUid)) {
      return json({ ok: false, error: 'معرف المريض غير صالح.' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('role, clinic_id, disabled')
      .eq('id', user.id)
      .maybeSingle();
    if (callerError || !caller || caller.disabled) {
      return json({ ok: false, error: 'الحساب غير مفعل أو لا يملك ملف صلاحيات.' }, 403);
    }

    const { data: patient, error: patientError } = await admin
      .from('patients')
      .select('clinic_id, invited_by')
      .eq('id', input.patientUid)
      .maybeSingle();
    if (patientError || !patient) return json({ ok: false, error: 'المريض غير موجود.' }, 404);

    const authorized = caller.role === 'owner' ||
      (caller.role === 'admin' && caller.clinic_id === patient.clinic_id) ||
      (caller.role === 'coach' && caller.clinic_id === patient.clinic_id && patient.invited_by === user.id);
    if (!authorized) return json({ ok: false, error: 'غير مخول لإرسال تنبيه لهذا المريض.' }, 403);

    if (caller.role !== 'owner') {
      const { data: subscription, error: subscriptionError } = await admin
        .from('clinic_subscriptions')
        .select('status')
        .eq('clinic_id', patient.clinic_id)
        .maybeSingle();
      if (subscriptionError || !subscription ||
          (subscription.status !== 'active' && subscription.status !== 'grace')) {
        return json({ ok: false, error: 'اشتراك العيادة غير نشط.' }, 403);
      }
    }

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from('push_subscriptions')
      .select('endpoint')
      .eq('patient_id', input.patientUid);
    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) return json({ ok: true, sent: 0, removed: 0 });

    let sent = 0;
    let removed = 0;
    for (const row of subscriptions as Array<{ endpoint: string }>) {
      const result = await sendEmptyPush(row.endpoint);
      if (result === 'sent') sent += 1;
      if (result === 'expired') {
        const { error: deleteError } = await admin
          .from('push_subscriptions')
          .delete()
          .eq('patient_id', input.patientUid)
          .eq('endpoint', row.endpoint);
        if (!deleteError) removed += 1;
      }
    }
    return json({ ok: true, sent, removed });
  } catch (error) {
    console.error('notify edge function failed', error);
    return json({ ok: false, error: 'تعذر إرسال التنبيه.' }, 500);
  }
});
