# Cloudflare Workers deployment

This is a full-stack Vite + Express application. A static-only Pages upload would omit the API endpoints used by the coach PIN session.

Architecture:
- Cloudflare Worker serves the Vite build from the static-assets binding.
- The same Worker routes /api/*, /health, and /coach-session through the existing Express router using Cloudflare Node HTTP compatibility.
- A SQLite-backed Durable Object implements coach PIN rate-limiting and token revocation. It replaces the Upstash Redis dependency on this hosting target.
- Supabase remains the application database and Auth provider. Patient photos remain in browser IndexedDB; this deployment does not create Storage buckets or move patient data.

Runtime secrets required on the Worker:
- CF_COACH_PIN: current Production COACH_PIN.
- CF_SESSION_SECRET: current Production SESSION_SECRET.

Repository GitHub Actions secrets required before deployment:
| Secret | Purpose |
|---|---|
| CLOUDFLARE_API_TOKEN | Account-scoped Cloudflare token with Workers Scripts:Edit and Durable Objects:Edit permissions |
| CLOUDFLARE_ACCOUNT_ID | Connected Cloudflare account ID |
| CF_COACH_PIN | Existing Production server-side coach PIN |
| CF_SESSION_SECRET | Existing Production coach-session HMAC signing secret |

The workflow transfers CF_COACH_PIN and CF_SESSION_SECRET into Cloudflare Worker secrets during deployment. They are never VITE variables and must not be committed.

The Worker is named smart-diet-v2. The first URL is https://smart-diet-v2.saaedbelal.workers.dev once deployed and the account workers.dev subdomain is enabled.

SQLite-backed Durable Objects are available on Workers Free. Cloudflare's current documentation lists 5 million rows read/day, 100,000 rows written/day, and 5 GB stored data in the free tier. When a daily free quota is exceeded, further operations of that type fail until reset; this deployment does not opt into a paid plan. Monitor usage before promoting this Worker to primary traffic.

The GitHub Actions workflow is manual only. It does not change Vercel, DNS, Supabase Auth redirects, or production traffic. First deploy to workers.dev and verify /health, /api/health, /api/coach-session, auth redirect/session behavior, and PWA behavior. Promote only after those checks pass.


## Notification boundary (mandatory)

This Worker is an optional hosting/API-runtime path only. It serves the frontend assets and the coach PIN/session routes listed in `wrangler.jsonc` (`/api/*`, `/health`, and `/coach-session`). It is **not** part of the notification architecture.

Notifications remain Supabase-only:
- Browser registration writes the patient's endpoint to `public.push_subscriptions` through Supabase.
- The client invokes `{VITE_SUPABASE_URL}/functions/v1/notify` directly.
- The Supabase Edge Function validates the caller and reads VAPID signing material from Supabase Vault.
- The Worker must not proxy `/functions/v1/notify`, store Push endpoints, receive VAPID secrets, or provide a fallback notification route.

A browser's Web Push vendor endpoint (such as Google's Chrome/Chromium endpoint) is only the final delivery destination; it does not make Cloudflare part of the backend.
