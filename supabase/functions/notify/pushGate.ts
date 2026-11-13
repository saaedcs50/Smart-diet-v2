/**
 * Server-side Web Push kill switch.
 *
 * Keep false until RFC 8291 aes128gcm payload encryption, standards test
 * vectors, and end-to-end delivery tests are implemented and reviewed.
 */
export const PUSH_DELIVERY_ENABLED = false;

/** A shared, testable response used when direct Edge Function calls are blocked. */
export function createPushDisabledResponse(): Response {
  return new Response(JSON.stringify({
    ok: false,
    error: 'الإشعارات متوقفة حتى تنفيذ تشفير Web Push RFC 8291',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
