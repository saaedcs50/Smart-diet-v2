// ============================================================================
// Supabase Edge Function: notify — إرسال إشعارات Web Push للمرضى (v3)
// ----------------------------------------------------------------------------
// إصلاح SDV2-INT-004: توقيع VAPID يستخدم raw r||s من WebCrypto (ليس DER)
// إصلاح SDV2-SEC-001: التحقق من disabled وحالة الاشتراك
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@smart-diet.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

function b64uE(d: Uint8Array): string {
  let b = '';
  for (let i = 0; i < d.length; i++) b += String.fromCharCode(d[i]);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uD(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const p = b + '='.repeat((4 - (b.length % 4)) % 4);
  const bin = atob(p);
  const r = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i);
  return r;
}

// SDV2-INT-004 FIX: WebCrypto returns raw 64-byte r||s, NOT DER.
// Use the signature directly without DER parsing.
async function createVapidAuth(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const privRaw = b64uD(VAPID_PRIVATE_KEY);

  // Convert raw 32-byte private key to PKCS8 for import
  const pkcs8Header = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
    0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + privRaw.length);
  pkcs8.set(pkcs8Header, 0);
  pkcs8.set(privRaw, pkcs8Header.length);

  const key = await crypto.subtle.importKey(
    'pkcs8', pkcs8.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const hb = b64uE(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cb = b64uE(enc.encode(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: VAPID_SUBJECT,
  })));
  const unsigned = `${hb}.${cb}`;

  // WebCrypto returns raw r||s (64 bytes) — use directly, NO DER parsing
  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)),
  );

  return `vapid t=${unsigned}.${b64uE(rawSig)}, k=${VAPID_PUBLIC_KEY}`;
}

async function sendWebPush(
  sub: PushSubscriptionJSON,
  title: string,
  body: string,
): Promise<boolean> {
  try {
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;
    if (!sub.endpoint.startsWith('https://')) return false;

    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const vapidAuth = await createVapidAuth(audience);

    const payload = JSON.stringify({ title, body });

    // Note: Sending without payload encryption (RFC 8291 aes128gcm not implemented).
    // This is a known limitation — see SDV2-INT-004 remediation.
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuth,
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
      },
      body: new TextEncoder().encode(payload),
    });

    // 410 Gone = subscription expired, 404 = not found
    return res.status === 201 || res.status === 200;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'غير مصرح' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error } = await sbAuth.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'توكن غير صالح' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { patientUid, title, body } = await req.json();
    if (!patientUid || !title) {
      return new Response(JSON.stringify({ ok: false, error: 'بيانات ناقصة' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate input size (SDV2-SEC-001)
    if (title.length > 200 || (body ?? '').length > 1000) {
      return new Response(JSON.stringify({ ok: false, error: 'النص طويل جدًا' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // SDV2-SEC-001 FIX: Check disabled status
    const { data: cp } = await sb
      .from('profiles')
      .select('role, clinic_id, disabled')
      .eq('id', user.id)
      .single();
    if (!cp) {
      return new Response(JSON.stringify({ ok: false, error: 'لا يوجد ملف' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if ((cp as { disabled?: boolean }).disabled) {
      return new Response(JSON.stringify({ ok: false, error: 'الحساب معطل' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: pat } = await sb
      .from('patients')
      .select('clinic_id, invited_by')
      .eq('id', patientUid)
      .single();
    if (!pat) {
      return new Response(JSON.stringify({ ok: false, error: 'المريض غير موجود' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const role = (cp as { role: string }).role;
    const cc = (cp as { clinic_id: string }).clinic_id;
    const pc = (pat as { clinic_id: string }).clinic_id;
    const ib = (pat as { invited_by: string | null }).invited_by;

    const authorized =
      role === 'owner' ||
      (role === 'admin' && cc === pc) ||
      (role === 'coach' && cc === pc && ib === user.id);
    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: 'غير مخول' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // SDV2-SEC-001 FIX: Check clinic subscription status
    if (role !== 'owner') {
      const { data: sub } = await sb
        .from('clinic_subscriptions')
        .select('status')
        .eq('clinic_id', pc)
        .single();
      const status = (sub as { status?: string } | null)?.status;
      if (status !== 'active' && status !== 'grace') {
        return new Response(JSON.stringify({ ok: false, error: 'اشتراك العيادة غير نشط' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: tr } = await sb
      .from('fcm_tokens')
      .select('tokens')
      .eq('patient_id', patientUid)
      .single();
    const tokens: string[] = (tr as { tokens?: string[] } | null)?.tokens ?? [];

    let sent = 0;
    let invalid = 0;
    for (const t of tokens) {
      try {
        const parsed = JSON.parse(t) as PushSubscriptionJSON;
        if (await sendWebPush(parsed, title, body ?? '')) {
          sent++;
        }
      } catch {
        invalid++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, invalid }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'خطأ داخلي' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
