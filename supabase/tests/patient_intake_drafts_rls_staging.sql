-- Patient intake draft authorization regression. Synthetic Staging only.
-- All parent intake, patient, and draft rows are rolled back.
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

-- Assigned patient may submit an intake, but cannot read or create a staff draft.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);

DO $test$
DECLARE
  intake_id uuid;
  n integer;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-a',
    auth.uid(),
    '{"clientName":"Assigned synthetic patient","heightCm":170,"startWeight":80,"targetWeight":70,"conditions":[],"allergies":[],"medicationsText":"","fastingType":"none","notes":"RLS draft test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.draft_assigned_intake_id', intake_id::text, true);

  SELECT count(*) INTO n FROM public.patient_intake_drafts;
  IF n <> 0 THEN RAISE EXCEPTION 'patient: staff draft was visible'; END IF;

  BEGIN
    INSERT INTO public.patient_intake_drafts (intake_id, draft_plan)
    VALUES (intake_id, '{"clientName":"forged patient draft"}'::jsonb);
    RAISE EXCEPTION 'patient inserted a staff-only draft';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- A different clinic-a patient submits an intake to verify doctor assignment.
SELECT set_config('request.jwt.claim.sub','84d4bec1-f1b9-4234-af9c-b61c924215c6',true);
SELECT set_config('request.jwt.claims','{"sub":"84d4bec1-f1b9-4234-af9c-b61c924215c6","role":"authenticated"}',true);
DO $test$
DECLARE intake_id uuid;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-a',
    auth.uid(),
    '{"clientName":"Unassigned synthetic patient","conditions":[],"allergies":[],"medicationsText":"","notes":"RLS draft test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.draft_unassigned_intake_id', intake_id::text, true);
END;
$test$;

-- A clinic-b patient submits an intake; clinic-a staff must not access it.
SELECT set_config('request.jwt.claim.sub','d4391923-54a7-4c5a-94b5-3782ff7d1e79',true);
SELECT set_config('request.jwt.claims','{"sub":"d4391923-54a7-4c5a-94b5-3782ff7d1e79","role":"authenticated"}',true);
DO $test$
DECLARE intake_id uuid;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-b',
    auth.uid(),
    '{"clientName":"Clinic-b synthetic patient","conditions":[],"allergies":[],"medicationsText":"","notes":"RLS draft test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.draft_other_clinic_intake_id', intake_id::text, true);
END;
$test$;

-- The assigned coach can create and update only the assigned patient's draft.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);
DO $test$
DECLARE
  n integer;
  assigned_id uuid := current_setting('test.draft_assigned_intake_id')::uuid;
  unassigned_id uuid := current_setting('test.draft_unassigned_intake_id')::uuid;
  other_clinic_id uuid := current_setting('test.draft_other_clinic_intake_id')::uuid;
BEGIN
  INSERT INTO public.patient_intake_drafts (intake_id, draft_plan)
  VALUES (assigned_id, '{"clientName":"Assigned draft","dailyWaterGoalMl":2000}'::jsonb);

  SELECT count(*) INTO n FROM public.patient_intake_drafts;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned draft visibility failed'; END IF;

  UPDATE public.patient_intake_drafts
  SET draft_plan = '{"clientName":"Updated assigned draft","dailyWaterGoalMl":2000}'::jsonb,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE intake_id = assigned_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned draft update failed'; END IF;

  SELECT count(*) INTO n FROM public.patient_intake_drafts WHERE intake_id = unassigned_id;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: unassigned draft was visible'; END IF;

  SELECT count(*) INTO n FROM public.patient_intake_drafts WHERE intake_id = other_clinic_id;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: cross-clinic draft was visible'; END IF;

  BEGIN
    INSERT INTO public.patient_intake_drafts (intake_id, draft_plan)
    VALUES (unassigned_id, '{"clientName":"forged unassigned draft"}'::jsonb);
    RAISE EXCEPTION 'coach created a draft for an unassigned patient';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE public.patient_intake_drafts
    SET status = 'approved'
    WHERE intake_id = assigned_id;
    RAISE EXCEPTION 'coach approved a draft through ordinary update privileges';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- Clinic admin can read clinic-a drafts. A patient and platform owner cannot.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_intake_drafts) <> 1 THEN
    RAISE EXCEPTION 'admin: clinic-wide draft visibility failed';
  END IF;
END;
$test$;

SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_intake_drafts) <> 0 THEN
    RAISE EXCEPTION 'patient: draft was visible before approval';
  END IF;
END;
$test$;

SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
SELECT set_config('request.jwt.claims','{"sub":"0b8b9208-bd7f-4d26-9613-e35dd277d066","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_intake_drafts) <> 0 THEN
    RAISE EXCEPTION 'owner: patient draft data must remain outside platform-owner access';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'patient_intake_drafts_rls_staging: PASS' AS result;
