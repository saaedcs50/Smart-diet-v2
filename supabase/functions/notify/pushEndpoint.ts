/**
 * Strict allow-list for browser-provided Web Push endpoints.
 *
 * Web Push service URLs are delivery destinations only. They are not an
 * application backend or a Cloudflare dependency. Chrome/Chromium uses the
 * FCM Web Push endpoint with VAPID; this does not use the legacy FCM API.
 */
export function isApprovedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;

    const host = url.hostname.toLowerCase();
    const standardProvider =
      host === 'updates.push.services.mozilla.com' ||
      host === 'web.push.apple.com' ||
      host.endsWith('.notify.windows.com');

    const chromiumProvider =
      host === 'fcm.googleapis.com' &&
      /^\/fcm\/send\/[^/?#]+$/.test(url.pathname) &&
      !url.search &&
      !url.hash;

    return standardProvider || chromiumProvider;
  } catch {
    return false;
  }
}
