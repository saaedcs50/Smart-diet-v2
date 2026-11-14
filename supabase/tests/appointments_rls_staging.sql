-- Appointment RLS and conflict regression tests for the synthetic Staging project.
-- Run only against Staging. All fixtures are scoped to a transaction and rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;
SET LOCAL ROLE authenticated;

-- Admin creates an appointment for a patient in their clinic.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);

INSERT INTO public.appointments (
  clinic_id, patient_id, provider_id, created_by,
  starts_at, ends_at, visit_type, channel
) VALUES (
  'clinic-a',
  'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
  '809f256f-0a4c-4b1e-af92-a26dd21d7623',
  '71d0a9c0-d539-487e-8d32-8af4dd7d5120',
  '2099-12-31 10:00:00+02',
  '2099-12-31 10:30:00+02',
  'follow_up',
  'in_person'
);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.appointments
  WHERE clinic_id='clinic-a'
    AND patient_id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  IF n <> 1 THEN RAISE EXCEPTION 'admin: appointment insert/read failed'; END IF;

  -- Another overlapping booking for the same doctor must be rejected.
  BEGIN
    INSERT INTO public.appointments (
      clinic_id, patient_id, provider_id, created_by, starts_at, ends_at
    ) VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '809f256f-0a4c-4b1e-af92-a26dd21d7623',
      '71d0a9c0-d539-487e-8d32-8af4dd7d5120',
      '2099-12-31 10:15:00+02',
      '2099-12-31 10:45:00+02'
    );
    RAISE EXCEPTION 'overlap: second appointment unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '23P01' THEN
    NULL;
  END;

  -- A patient from another clinic must not be schedulable by clinic-a admin.
  BEGIN
    INSERT INTO public.appointments (
      clinic_id, patient_id, provider_id, created_by, starts_at, ends_at
    ) VALUES (
      'clinic-a',
      'd4391923-54a7-4c5a-94b5-3782ff7d1e79',
      '809f256f-0a4c-4b1e-af92-a26dd21d7623',
      '71d0a9c0-d539-487e-8d32-8af4dd7d5120',
      '2099-12-31 11:00:00+02',
      '2099-12-31 11:30:00+02'
    );
    RAISE EXCEPTION 'cross-clinic: appointment unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- Coach can see their own appointment, but cannot schedule for a patient outside their clinic.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.appointments;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: appointment scope incorrect'; END IF;

  BEGIN
    INSERT INTO public.appointments (
      clinic_id, patient_id, provider_id, created_by, starts_at, ends_at
    ) VALUES (
      'clinic-a',
      'd4391923-54a7-4c5a-94b5-3782ff7d1e79',
      '809f256f-0a4c-4b1e-af92-a26dd21d7623',
      '809f256f-0a4c-4b1e-af92-a26dd21d7623',
      '2099-12-31 11:00:00+02',
      '2099-12-31 11:30:00+02'
    );
    RAISE EXCEPTION 'coach cross-clinic insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- The patient sees their own appointment but cannot change its status.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.appointments;
  IF n <> 1 THEN RAISE EXCEPTION 'patient: own appointment not visible'; END IF;

  UPDATE public.appointments SET status='completed';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'patient: appointment update should be denied'; END IF;
END;
$test$;

-- A different clinic patient sees no appointment rows.
SELECT set_config('request.jwt.claim.sub','d4391923-54a7-4c5a-94b5-3782ff7d1e79',true);
SELECT set_config('request.jwt.claims','{"sub":"d4391923-54a7-4c5a-94b5-3782ff7d1e79","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.appointments) <> 0 THEN
    RAISE EXCEPTION 'patient-b: cross-clinic appointment visible';
  END IF;
END;
$test$;

-- Platform owner intentionally has no access to clinic appointments.
SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
SELECT set_config('request.jwt.claims','{"sub":"0b8b9208-bd7f-4d26-9613-e35dd277d066","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.appointments) <> 0 THEN
    RAISE EXCEPTION 'owner: clinic appointments must not be exposed';
  END IF;
END;
$test$;

ROLLBACK;
