# Notification Architecture — Supabase-only

**Decision:** Smart Diet notifications are a Supabase-owned feature. Cloudflare is not part of registration, authorization, signing, delivery, storage, queuing, or retrying notifications.

## Authoritative flow

1. The patient explicitly grants browser notification permission.
2. The browser creates a standards-based Web Push subscription.
3. The app authenticates the patient through Supabase Auth and registers only the endpoint through `public.push_subscriptions` using `claim_push_subscription`.
4. PostgreSQL RLS and the registration function require the signed-in patient, correct patient UID, active clinic, and active/grace clinic subscription. The registration path does not accept another patient's endpoint.
5. The doctor/admin client calls the Supabase Edge Function directly at `{VITE_SUPABASE_URL}/functions/v1/notify`, passing the caller's Supabase access token and the public API key.
6. The Edge Function validates the JWT, caller role, patient/clinic relationship, clinic status, and subscription status. It reads VAPID signing configuration from Supabase Vault via the service-only database function `get_push_signing_config`.
7. The Edge Function sends an empty Web Push request to the browser vendor endpoint. The payload must not contain patient names, clinical text, diagnoses, weight, measurements, medication, or plan details.

## Where each responsibility lives

| Responsibility | Authoritative component |
|---|---|
| Patient identity and caller session | Supabase Auth |
| Registered browser endpoint | `public.push_subscriptions` (PostgreSQL + RLS) |
| Endpoint registration authorization | `claim_push_subscription` |
| Notification authorization and delivery orchestration | Supabase Edge Function `notify` |
| VAPID signing configuration | Supabase Vault; read only by `service_role` through `get_push_signing_config` |
| Browser display and notification click handling | PWA Service Worker |
| Browser-vendor delivery endpoint | Browser's Web Push provider (for example, Google FCM for Chrome/Chromium, Mozilla, Apple, or Windows) |

A browser-vendor URL is only the standards-based destination used by Web Push. It is not an application server, notification backend, or authorization provider.

## Cloudflare boundary

Cloudflare Worker / Durable Object work in PR #75 is a separate, optional application-hosting/API-runtime path for the frontend and coach PIN/session routes (`/api/*`, `/health`, and `/coach-session`). It is not part of the notification path.

The Worker must not:
- proxy or reimplement `/functions/v1/notify`;
- receive VAPID private keys, push endpoints, push subscriptions, or notification payloads;
- persist notification state or become a notification queue/retry service;
- become a fallback when the Supabase Edge Function is unavailable.

The notification client must continue to call the Supabase function URL directly. Do not add a Cloudflare notification URL or a generic API-base fallback.

## Compatibility and security notes

- The endpoint allow-list includes Mozilla, Apple, Windows, and (in PR #76) the Chrome/Chromium Web Push endpoint `https://fcm.googleapis.com/fcm/send/{token}`. The additive schema migration and Edge Function update are applied to Staging only so far; Production remains on its previous allow-list until the PR and release migration are approved. This is Web Push with VAPID, not the retired legacy FCM server-key API.
- Only endpoint URLs are stored in `push_subscriptions`; browser `p256dh`/`auth` keys are not stored by this implementation.
- Only the public VAPID key is exposed as `VITE_VAPID_PUBLIC_KEY`. The private signing key and VAPID subject stay in Supabase Vault.
- Edge Function JWT verification remains enabled.
- Empty payload is intentional until a separately reviewed encrypted-payload implementation is approved and tested.
- Never copy patient data to Cloudflare to implement notifications.

## Verification record

Verified on 18 November 2026:
- Production and Staging Supabase projects are healthy.
- Edge Function `notify` is ACTIVE in both projects and has `verify_jwt = true`.
- Both projects have the push endpoint registry and hardened registration function.
- `src/platform/push.ts` calls the Supabase Edge Function directly.
- Cloudflare account inventory returned one unrelated Worker named `youngtube-worker` and its own Durable Object namespaces; no Worker named `smart-diet-v2` was present. PR #75's Smart Diet deployment workflow is manual and the PR states it has not deployed a Worker.

Live device delivery across Chrome, Firefox, Safari, and Windows still requires browser/device E2E validation; the repository's unit tests do not prove delivery to a real device.
