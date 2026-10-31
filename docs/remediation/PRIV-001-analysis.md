# SDV2-PRIV-001 — Local Data Isolation Analysis

**Status:** DOCUMENTED — Full implementation deferred (requires careful migration)

## Problem

Browser-local data (localStorage, IndexedDB) is namespaced by brand slug, not by user identity. On a shared device:
- User A logs in, uses the app, logs out
- User B logs in on the same browser → can potentially see User A's local data
- Logout does not clear or isolate the previous user's data

## Key Inventory

### localStorage (via StorageKeys)
- `plan`, `dayLogs` (prefixed by date), `activeFasting`, `notificationSettings`
- `coachPinHash`, `coachUnlocked` (coach-specific)
- `water`, `weight`, `medications`, `bodyLogs` (various)
- All keys use `brandStorageSlug()` prefix, NOT user ID

### IndexedDB
- Photo comparison images (via `indexedDB.ts`)
- No user scoping observed

### Service Worker
- `public/sw.js` — handles push notifications only, no app-shell caching of private data (good)
- No evidence of private API response caching

## Recommended Approach

1. **Namespace by identity:** Change `StorageKeys` to include user/profile ID:
   - Anonymous/local: `brand:{slug}:local:{profileId}:...`
   - Authenticated: `brand:{slug}:user:{uid}:...`

2. **Logout behavior:** On logout/account switch:
   - Clear in-memory state immediately
   - Switch to the new user's namespace (don't delete old data — preserve under its own namespace)
   - Provide explicit "Delete my local data" option in settings

3. **Migration:** On first run after update, migrate existing un-namespaced keys to the current user's namespace (or a `legacy` namespace with prompt).

4. **IndexedDB:** Add `userId` index to photo records; filter by current user on read.

## Why Deferred

This requires:
- Changes to every StorageKeys call site
- A migration for existing users' data
- UI for data management/deletion
- Testing on shared devices

The risk is MEDIUM (requires physical device access), and the fix is invasive. Documented here for prioritized scheduling.
