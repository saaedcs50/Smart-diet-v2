-- Patient archive/restore access regression; synthetic Staging only.
-- All archive updates are rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a assigned patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79

BEGIN;
SET LOCAL ROLE authenticated;

-- Assigned coach can archive and restore only their clinic-a patient.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  UPDATE public.patients
  SET archived_at=now(), archived_by=auth.uid()
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8'
    AND clinic_id='clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'assigned coach could not archive assigned patient'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8'
      AND archived_at IS NOT NULL
      AND archived_by=auth.uid()
  ) THEN RAISE EXCEPTION 'archive timestamp/actor was not saved'; END IF;

  UPDATE public.patients
  SET archived_at=NULL, archived_by=NULL
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8'
    AND clinic_id='clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'assigned coach could not restore assigned patient'; END IF;

  UPDATE public.patients
  SET archived_at=now(), archived_by=auth.uid()
  WHERE id='d4391923-54a7-4c5a-94b5-3782ff7d1e79'
    AND clinic_id='clinic-b';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach archived a patient from another clinic'; END IF;
END;
$test$;

-- Patient self cannot archive own profile row.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  UPDATE public.patients
  SET archived_at=now(), archived_by=auth.uid()
  WHERE id=auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'patient archived own clinic file'; END IF;
END;
$test$;

-- Admin can archive the clinic patient; the entire patient row and plan remain present.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  UPDATE public.patients
  SET archived_at=now(), archived_by=auth.uid()
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8'
    AND clinic_id='clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'admin could not archive clinic patient'; END IF;

  SELECT count(*) INTO n FROM public.patients
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  IF n <> 1 THEN RAISE EXCEPTION 'archiving removed the patient record'; END IF;
END;
$test$;

-- Reject a timestamp/actor mismatch even for a role with update access.
DO $test$
BEGIN
  UPDATE public.patients
  SET archived_at=now(), archived_by=NULL
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  RAISE EXCEPTION 'archive timestamp without actor was accepted';
EXCEPTION WHEN check_violation THEN
  NULL;
END;
$test$;

ROLLBACK;
SELECT 'patient_archive_rls_staging: PASS' AS result;
