# SDV2-CONF-003: Legacy Firebase/Cloudflare Files Analysis

**Date:** 2026-10-31
**Status:** Analysis complete — removal requires user approval (destructive)

## Files Found

| File | Size | Still Referenced? | Recommendation |
|------|------|-------------------|----------------|
| `firebase.json` | 104B | No (only for emulator) | **SAFE TO REMOVE** — Firebase emulator config, not used |
| `firestore.rules` | 17KB | No (CI still runs emulator test) | **KEEP FOR NOW** — CI `test:rules` job uses it. Remove when CI job is removed. |
| `public/firebase-messaging-sw.js` | 1.1KB | No (replaced by native Web Push) | **SAFE TO REMOVE** — Legacy FCM SW, replaced by Web Push in `fcm.ts` |
| `src/platform/firebase.ts` | 7KB | No (zero imports) | **SAFE TO REMOVE** — Not imported by any file. Verified via grep. |

## Already Removed (PR #32)
- `fcm-worker/` — Cloudflare Worker source (deleted from repo and Cloudflare)

## CI Impact
- `.github/workflows/quality.yml` has a `rules` job running `npm run test:rules` (Firestore emulator).
- If `firestore.rules` is removed, the CI job must also be removed/updated.

## Recommendation
1. Remove `firebase.json`, `public/firebase-messaging-sw.js`, `src/platform/firebase.ts` (safe, zero references)
2. Keep `firestore.rules` until the CI `test:rules` job is explicitly retired
3. Do NOT delete without user approval (destructive, per task rules)
