-- Patient intake authorization regression. Synthetic Staging only.
-- All records are rolled back at the end.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a assigned patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-a unassigned patient: 84d4bec1-f1b9-4234-af9c-b61c924215c6
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;

-- Add the test-only unassigned patient row if the synthetic auth profile has no patient row yet.
INSERT INTO public.patients (id, clinic_id, profile, invited_by)
VALUES (
  '84d4bec1-f1b9-4234-af9c-b61c924215c6',
  'clinic-a',
  '{"clientName":"Unassigned synthetic patient"}'::jsonb,
  NULL
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;

-- A patient can submit and read only their own intake.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);

INSERT INTO public.patient_intakes (
  id, clinic_id, patient_id, answers, consent_version
) VALUES (
  'aaaaaaaa-1111-4111-8111-111111111111',
  'clinic-a',
  'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
  '{"clientName":"Assigned patient","heightCm":170,"startWeight":80,"targetWeight":70,"targetWaist":null,"conditions":[{"id":"ibs","label":"IBS"}],"allergies":["Lactose"],"medicationsText":"Example medicine","sleepHours":7,"activityLevel":"moderate","fastingType":"none","goal":"Better habits","notes":""}'::jsonb,
  'patient-intake-test-v1'
);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_intakes
  WHERE id='aaaaaaaa-1111-4111-8111-111111111111';
  IF n <> 1 THEN RAISE EXCEPTION 'patient: own intake insert/read failed'; END IF;

  SELECT count(*) INTO n FROM public.patient_intakes
  WHERE id='aaaaaaaa-1111-4111-8111-111111111111'
    AND submitted_by=auth.uid()
    AND status='submitted'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'patient: server-owned submission fields were not applied'; END IF;

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

  UPDATE public.patient_intakes
  SET status='reviewed', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id='aaaaaaaa-1111-4111-8111-111111111111';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'patient updated their own intake'; END IF;

  SELECT count(*) INTO n FROM public.patient_intakes
  WHERE id='aaaaaaaa-1111-4111-8111-111111111111' AND status='submitted';
  IF n <> 1 THEN RAISE EXCEPTION 'patient changed intake review state'; END IF;
END;
$test$;

-- An unassigned patient may submit, but the coach cannot read their intake.
SELECT set_config('request.jwt.claim.sub','84d4bec1-f1b9-4234-af9c-b61c924215c6',true);
SELECT set_config('request.jwt.claims','{"sub":"84d4bec1-f1b9-4234-af9c-b61c924215c6","role":"authenticated"}',true);

INSERT INTO public.patient_intakes (
  id, clinic_id, patient_id, answers, consent_version
) VALUES (
  'bbbbbbbb-2222-4222-8222-222222222222',
  'clinic-a',
  '84d4bec1-f1b9-4234-af9c-b61c924215c6',
  '{"clientName":"Unassigned patient","conditions":[],"allergies":[],"medicationsText":"", "notes":"test"}'::jsonb,
  'patient-intake-test-v1'
);

-- A patient in another clinic may submit under their own clinic.
SELECT set_config('request.jwt.claim.sub','d4391923-54a7-4c5a-94b5-3782ff7d1e79',true);
SELECT set_config('request.jwt.claims','{"sub":"d4391923-54a7-4c5a-94b5-3782ff7d1e79","role":"authenticated"}',true);

INSERT INTO public.patient_intakes (
  id, clinic_id, patient_id, answers, consent_version
) VALUES (
  'cccccccc-3333-4333-8333-333333333333',
  'clinic-b',
  'd4391923-54a7-4c5a-94b5-3782ff7d1e79',
  '{"clientName":"Cross clinic patient","conditions":[],"allergies":[],"medicationsText":"", "notes":"test"}'::jsonb,
  'patient-intake-test-v1'
);

-- Coach sees only the assigned patient's intake and can mark it reviewed.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_intakes;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned-patient scope failed'; END IF;

  UPDATE public.patient_intakes
  SET status='reviewed', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id='aaaaaaaa-1111-4111-8111-111111111111' AND status='submitted';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: authorized review failed'; END IF;

  UPDATE public.patient_intakes
  SET status='reviewed', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id='bbbbbbbb-2222-4222-8222-222222222222';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: unassigned patient intake was modified'; END IF;
END;
$test$;

-- Admin can view the two intakes in clinic-a, but not clinic-b.
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
