-- Patient private/shared reflections RLS regression. Synthetic Staging only.
-- All rows are created and deleted inside the rollback transaction.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a assigned patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;
SET LOCAL ROLE authenticated;

-- Patient writes two entries: one private and one explicitly shared.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);

INSERT INTO public.patient_reflections (
  clinic_id, patient_id, entry_date, content, mood, symptoms, visibility
) VALUES
  ('clinic-a','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','2026-11-22','Private reflection',3,'Private symptom note','private'),
  ('clinic-a','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','2026-11-21','Shared reflection',4,'Shared symptom note','shared');

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_reflections;
  IF n <> 2 THEN RAISE EXCEPTION 'patient: own private and shared entries are not both visible'; END IF;

  DELETE FROM public.patient_reflections
  WHERE patient_id=auth.uid() AND visibility='private' AND content='Private reflection';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'patient: deleting own private reflection failed'; END IF;
END;
$test$;

-- A patient in another clinic can write their own reflection, but it is not exposed to clinic-a staff.
SELECT set_config('request.jwt.claim.sub','d4391923-54a7-4c5a-94b5-3782ff7d1e79',true);
SELECT set_config('request.jwt.claims','{"sub":"d4391923-54a7-4c5a-94b5-3782ff7d1e79","role":"authenticated"}',true);
INSERT INTO public.patient_reflections (
  clinic_id, patient_id, entry_date, content, visibility
) VALUES (
  'clinic-b','d4391923-54a7-4c5a-94b5-3782ff7d1e79','2026-11-22','Other clinic shared reflection','shared'
);

-- Coach sees only the shared entry from their assigned patient.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_reflections;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: private or cross-clinic reflection leaked'; END IF;

  BEGIN
    INSERT INTO public.patient_reflections (
      clinic_id, patient_id, entry_date, content, visibility
    ) VALUES (
      'clinic-a','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','2026-11-22','Coach cannot author patient reflection','shared'
    );
    RAISE EXCEPTION 'coach authored patient reflection';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  UPDATE public.patient_reflections
  SET visibility='shared', updated_at=now()
  WHERE patient_id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach modified patient reflection privacy'; END IF;
END;
$test$;

-- Admin sees the shared clinic-a reflection but never the private one.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_reflections;
  IF n <> 1 THEN RAISE EXCEPTION 'admin: shared-only clinic view failed'; END IF;
END;
$test$;

-- Platform owner is not permitted to read clinic reflections.
SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
SELECT set_config('request.jwt.claims','{"sub":"0b8b9208-bd7f-4d26-9613-e35dd277d066","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_reflections) <> 0 THEN
    RAISE EXCEPTION 'owner: patient reflections must not be exposed';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'patient_reflections_rls_staging: PASS' AS result;
