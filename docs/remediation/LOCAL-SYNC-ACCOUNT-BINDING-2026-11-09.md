# Smart Diet v2 — local sync account binding

**Date:** 2026-11-09  
**Scope:** Browser-local data → patient cloud sync boundary

## Risk addressed

The app's offline plan and daily logs are stored under the clinic/brand namespace. The migration UI previously allowed the currently signed-in patient to upload this device-wide snapshot after confirming cloud-sync consent, without confirming that the existing local data belonged to that patient. A second patient on a shared browser could therefore attempt to upload the first patient's local records.

## Implemented safeguard

- The first patient who initiates migration must separately confirm that all local plan/day-log data on the device belongs to the currently signed-in patient.
- After successful consent storage, a local ownership marker binds this browser's existing local dataset to that patient UID.
- A different UID is treated as a mismatch: the summary is hidden, the migration action is disabled, and the handler re-checks the marker before any cloud write.
- An unreadable/corrupt ownership marker fails closed.
- The marker is immutable from the application; another patient must use a separate browser profile/device or have local data reset through a separately reviewed reset flow.
- The sync status key is now patient-specific, so one patient's last-run metadata is not shown to another.

## Tests

Unit tests cover first binding, same-user match, second-user rejection, malformed marker fail-closed behavior, empty UID rejection, and per-patient sync status separation.

## Explicit limitation

This is a defensive cloud-sync ownership gate, **not full per-account encryption or namespacing of all offline application data**. The offline tracker still stores its dataset under the clinic/brand namespace so existing local-only users do not lose access. A later PRIV-001 phase must implement a consented migration into UID-specific localStorage and IndexedDB namespaces, plus a reviewed reset/export flow for shared devices. No local plan, health record, or photo was copied, deleted, or rewritten by this change.
