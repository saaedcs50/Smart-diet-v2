-- Personal staff task RLS test. Run only on the synthetic Staging project.
-- All inserted test rows are rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a patient: 84d4bec1-f1b9-4234-af9c-b61c924215c6
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);

INSERT INTO public.clinic_tasks (clinic_id, user_id, title, priority, due_on)
VALUES ('clinic-a','71d0a9c0-d539-487e-8d32-8af4dd7d5120','Admin personal task','high','2099-12-31');

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 1 THEN RAISE EXCEPTION 'admin: own task insert/read failed'; END IF;
END;
$test$;

-- Coach cannot see the admin's personal task; creates and updates only their own task.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: admin personal task leaked'; END IF;
END;
$test$;

INSERT INTO public.clinic_tasks (clinic_id, user_id, title, priority)
VALUES ('clinic-a','809f256f-0a4c-4b1e-af92-a26dd21d7623','Coach personal task','normal');

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: own task insert/read failed'; END IF;

  UPDATE public.clinic_tasks
  SET status='completed', updated_at=now()
  WHERE title='Coach personal task';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: own task update failed'; END IF;

  UPDATE public.clinic_tasks
  SET status='completed'
  WHERE title='Admin personal task';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: updated another user task'; END IF;
END;
$test$;

-- Admin cannot read the coach's private task either.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 1 THEN RAISE EXCEPTION 'admin: another staff member task leaked'; END IF;

  BEGIN
    INSERT INTO public.clinic_tasks (clinic_id, user_id, title)
    VALUES ('clinic-b','71d0a9c0-d539-487e-8d32-8af4dd7d5120','Cross-clinic task');
    RAISE EXCEPTION 'cross-clinic insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- Patients and platform owner have no access to the staff-only task list.
SELECT set_config('request.jwt.claim.sub','84d4bec1-f1b9-4234-af9c-b61c924215c6',true);
SELECT set_config('request.jwt.claims','{"sub":"84d4bec1-f1b9-4234-af9c-b61c924215c6","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 0 THEN RAISE EXCEPTION 'patient: staff tasks visible'; END IF;

  BEGIN
    INSERT INTO public.clinic_tasks (clinic_id, user_id, title)
    VALUES ('clinic-a','84d4bec1-f1b9-4234-af9c-b61c924215c6','Patient task');
    RAISE EXCEPTION 'patient insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
SELECT set_config('request.jwt.claims','{"sub":"0b8b9208-bd7f-4d26-9613-e35dd277d066","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.clinic_tasks) <> 0 THEN
    RAISE EXCEPTION 'owner: personal clinic tasks must not be exposed';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'clinic_tasks_rls_staging: PASS' AS result;
