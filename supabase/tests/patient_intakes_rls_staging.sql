-- Patient intake authorization regression. Synthetic Staging only.
-- All rows, including the optional patient fixture, are rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a assigned patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-a unassigned patient: 84d4bec1-f1b9-4234-af9c-b61c924215c6
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;

INSERT INTO public.patients (id, clinic_id, profile, invited_by)
VALUES (
  '84d4bec1-f1b9-4234-af9c-b61c924215c6',
  'clinic-a',
  '{"clientName":"Unassigned synthetic patient"}'::jsonb,
  NULL
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;

-- Patient can create and read their own submission. Review status and creator
-- are server-owned; forged columns and a forged consent version are rejected.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);

DO $test$
DECLARE
  intake_id uuid;
  n integer;
BEGIN
  INSERT INTO public.patient_intakes (
    clinic_id, patient_id, answers, consent_version
  ) VALUES (
    'clinic-a',
    'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
    '{"clientName":"Assigned patient","heightCm":170,"startWeight":80,"targetWeight":70,"targetWaist":null,"conditions":[{"id":"ibs","label":"IBS"}],"allergies":["Lactose"],"medicationsText":"Example medicine","sleepHours":7,"activityLevel":"moderate","fastingType":"none","goal":"Better habits","notes":""}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.patient_intake_assigned_id', intake_id::text, true);

  SELECT count(*) INTO n FROM public.patient_intakes WHERE id=intake_id;
  IF n <> 1 THEN RAISE EXCEPTION 'patient: own intake insert/read failed'; END IF;

  SELECT count(*) INTO n FROM public.patient_intakes
  WHERE id=intake_id AND submitted_by=auth.uid()
    AND status='submitted' AND reviewed_at IS NULL AND reviewed_by IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'patient: server-owned submission fields were not applied'; END IF;

  UPDATE public.patient_intakes
  SET status='reviewed', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id=intake_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'patient updated their own intake'; END IF;

  SELECT count(*) INTO n FROM public.patient_intakes
  WHERE id=intake_id AND status='submitted';
  IF n <> 1 THEN RAISE EXCEPTION 'patient changed intake review state'; END IF;

  BEGIN
    INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version, status)
    VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '{"clientName":"Forged status","conditions":[],"allergies":[]}'::jsonb,
      'patient-intake-v1-2026-11-22',
      'reviewed'
    );
    RAISE EXCEPTION 'patient inserted a forged review status';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.patient_intakes (clinic_id, patient_id, submitted_by, answers, consent_version)
    VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '71d0a9c0-d539-487e-8d32-8af4dd7d5120',
      '{"clientName":"Forged creator","conditions":[],"allergies":[]}'::jsonb,
      'patient-intake-v1-2026-11-22'
    );
    RAISE EXCEPTION 'patient supplied another creator';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
    VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '{"clientName":"Forged consent version","conditions":[],"allergies":[]}'::jsonb,
      'forged-version'
    );
    RAISE EXCEPTION 'patient inserted an unrecognized consent version';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- An unassigned clinic-a patient can submit, but the coach must not see it.
SELECT set_config('request.jwt.claim.sub','84d4bec1-f1b9-4234-af9c-b61c924215c6',true);
SELECT set_config('request.jwt.claims','{"sub":"84d4bec1-f1b9-4234-af9c-b61c924215c6","role":"authenticated"}',true);
DO $test$
DECLARE intake_id uuid;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-a',
    '84d4bec1-f1b9-4234-af9c-b61c924215c6',
    '{"clientName":"Unassigned patient","conditions":[],"allergies":[],"medicationsText":"","notes":"test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.patient_intake_unassigned_id', intake_id::text, true);
END;
$test$;

-- A patient in clinic-b can submit within clinic-b.
SELECT set_config('request.jwt.claim.sub','d4391923-54a7-4c5a-94b5-3782ff7d1e79',true);
SELECT set_config('request.jwt.claims','{"sub":"d4391923-54a7-4c5a-94b5-3782ff7d1e79","role":"authenticated"}',true);
DO $test$
DECLARE intake_id uuid;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-b',
    'd4391923-54a7-4c5a-94b5-3782ff7d1e79',
    '{"clientName":"Cross clinic patient","conditions":[],"allergies":[],"medicationsText":"","notes":"test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.patient_intake_other_clinic_id', intake_id::text, true);
END;
$test$;

-- Coach sees only the assigned patient's intake and may mark it reviewed.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_intakes;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned-patient scope failed'; END IF;

  UPDATE public.patient_intakes
  SET status='reviewed', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id=current_setting('test.patient_intake_assigned_id')::uuid
    AND status='submitted';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: authorized review failed'; END IF;

  UPDATE public.patient_intakes
  SET status='reviewed', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id=current_setting('test.patient_intake_unassigned_id')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: unassigned patient intake was modified'; END IF;

  SELECT count(*) INTO n FROM public.patient_intakes
  WHERE id=current_setting('test.patient_intake_other_clinic_id')::uuid;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: cross-clinic intake was visible'; END IF;
END;
$test$;

-- Admin sees both clinic-a intakes but not the clinic-b record.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_intakes;
  IF n <> 2 THEN RAISE EXCEPTION 'admin: clinic-wide intake visibility failed'; END IF;
END;
$test$;

-- Platform owner is intentionally outside clinic intake access.
SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
SELECT set_config('request.jwt.claims','{"sub":"0b8b9208-bd7f-4d26-9613-e35dd277d066","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_intakes) <> 0 THEN
    RAISE EXCEPTION 'owner: patient health intakes must not be exposed';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'patient_intakes_rls_staging: PASS' AS result;
