# Phase 8 — Daily health metrics and staging RLS verification

Date: 2026-11-14

## Implemented from the consolidated feature list

- Feature 201: added optional, date-scoped body-fat, blood-glucose, and systolic/diastolic blood-pressure fields to `DayLog`.
- Added patient entry controls in the Body tab. Empty values remain absent/null; non-finite and negative values are rejected by the update path.
- Added the measurements to the clinician's cloud day-history view.
- Added explicit columns to the doctor export's Patients and Daily Logs worksheets. The full day-log JSON remains available as well.
- No SQL migration is required: the platform stores each day log as JSONB, and the new properties are part of that existing JSON document.

## Verification performed

- Ran `supabase/tests/rls_role_matrix_staging.sql` against the Staging project `smart-diet-v2-staging`.
- The script completed without a raised exception. It exercised owner, clinic admin, assigned coach, patient, disabled coach, suspended clinic, and anonymous access.
- The script performs its writes inside one transaction and ends with `ROLLBACK`. A separate preflight check confirmed the documented synthetic Staging fixtures were present before execution.
- This confirms a manual Staging run at this revision; it does not claim the SQL matrix is yet wired into every CI run.

## Deliberately not enabled in this phase

- Web Push delivery remains disabled. The current Edge Function kill switch explicitly requires RFC 8291 `aes128gcm` encryption, standards test vectors, and end-to-end delivery tests before enabling it. The implementation must not bypass that gate.
- Appointments, chart notes, client portal, multi-location, workflows, and localized AI meal generation remain dependent on the prerequisite systems called out in the source specification.
- Visual direction item 253 remains paused by the specification itself pending content requirements.

## Data and clinical safety

These daily values are recorded observations only. The app does not convert them into diagnosis, alerts, or treatment recommendations. Units are displayed with each input and export column. Older day logs remain valid because the new fields are optional.
