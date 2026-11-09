# Smart Diet v2 — Phase 7 doctor data exports

**Date:** 2026-11-09  
**Branch:** `codex/phase7-doctor-data-exports`

## Delivery

The doctor dashboard now contains separate CSV, Excel, and PDF/print actions. The controls are rendered in `CoachDashboard` only; the clinic admin dashboard does not expose patient export controls.

Before each export, the app re-queries the current signed-in coach's assigned patients using both `clinic_id = current clinic` and `invited_by = current coach UID`. RLS remains active for every request. The export does not trust the dashboard's cached patient list or a browser-only filter.

Patient and daily-log history is read with stable pagination (500 rows per page). Adherence configuration and adherence scores are read per patient under RLS, also with pagination. Patient reads are processed in batches of four to avoid a burst of concurrent queries. Any page/query or malformed daily-log/score error aborts the export rather than silently creating an incomplete report.

## Formats

- **CSV:** UTF-8 with BOM for Excel compatibility. One flat file contains patient-level plan fields and repeated daily-log rows. Formula-like untrusted text is prefixed to prevent spreadsheet formula execution. Negative numeric values remain numeric.
- **Excel (.xlsx):** an OpenXML workbook generated without adding a new runtime dependency. It contains three worksheets: `Patients`, `Daily Logs`, and `Adherence Scores`. The ZIP writer uses STORE entries and CRC-32; tests inspect the central directory and validate every entry CRC. Full plan and log snapshots are included as JSON columns for fields that evolve over time.
- **PDF:** a right-to-left Arabic HTML report opened in a new window and printed/saved as PDF through the browser. The report includes each patient's plan summary, adherence history, and daily log summary. Browser printing is used to retain Arabic shaping and pagination; no raster-only PDF is forced.

## Privacy and safety

- Only a coach's own assigned patients are queried. Admin-level clinic-wide export is not implemented.
- Legacy `adminPin` is explicitly omitted from the full plan snapshot and never included in the export.
- Patient-controlled strings are HTML escaped in the print report.
- An in-product warning tells the doctor that files contain sensitive health data and should be stored/shared securely.
- No patient records are modified by export.

## Tests

Unit tests cover:
- patient, daily log, and adherence sheet construction;
- PIN redaction from plan JSON;
- CSV BOM, quoting, and formula-injection mitigation;
- OpenXML workbook parts, worksheets, STORE compression method, and ZIP entry CRCs;
- HTML escaping of patient-controlled names and presence of the browser print action.

## Implementation note

The repository did not include the planned `xlsx` package in its dependencies. To avoid increasing the supply-chain footprint, this change uses a small dependency-free OpenXML/ZIP STORE writer. It is covered by structural/CRC tests, but a future maintenance pass may replace it with the official `xlsx` library if the project elects to accept that dependency. The PDF workflow opens a browser print report instead of generating a flattened image-only PDF; the user chooses “Print / Save as PDF” in the new tab.
