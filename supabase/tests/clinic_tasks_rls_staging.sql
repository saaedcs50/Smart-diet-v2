-- Clinic task delegation RLS regression. Run only on synthetic Staging.
-- All rows are created inside a transaction and rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a patient: 84d4bec1-f1b9-4234-af9c-b61c924215c6
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;
SET LOCAL ROLE authenticated;

-- Admin can create a task for a coach and can also create a task for themselves.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);

INSERT INTO public.clinic_tasks (clinic_id, user_id, title, priority, due_on)
VALUES
  ('clinic-a','809f256f-0a4c-4b1e-af92-a26dd21d7623','Task assigned to coach','high','2099-12-31'),
  ('clinic-a','71d0a9c0-d539-487e-8d32-8af4dd7d5120','Admin personal task','normal',null);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 2 THEN RAISE EXCEPTION 'admin: clinic-wide task visibility failed'; END IF;

  -- Admin cannot assign to patients or members from another clinic.
  BEGIN
    INSERT INTO public.clinic_tasks (clinic_id, user_id, title)
    VALUES ('clinic-a','84d4bec1-f1b9-4234-af9c-b61c924215c6','Patient must not receive staff task');
    RAISE EXCEPTION 'admin assigned a staff task to a patient';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.clinic_tasks (clinic_id, user_id, title)
    VALUES ('clinic-a','d4391923-54a7-4c5a-94b5-3782ff7d1e79','Cross-clinic task');
    RAISE EXCEPTION 'cross-clinic assignment unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- Coach sees only tasks assigned to them; can update status but cannot reassign.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned task visibility incorrect'; END IF;

  UPDATE public.clinic_tasks SET status='in_progress', updated_at=now()
  WHERE title='Task assigned to coach';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned task status update failed'; END IF;

  UPDATE public.clinic_tasks SET status='completed'
  WHERE title='Admin personal task';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: updated task assigned to admin'; END IF;

  -- A coach can create only a personal task, never delegate.
  INSERT INTO public.clinic_tasks (clinic_id, user_id, title)
  VALUES ('clinic-a','809f256f-0a4c-4b1e-af92-a26dd21d7623','Coach personal task');

  BEGIN
    INSERT INTO public.clinic_tasks (clinic_id, user_id, title)
    VALUES ('clinic-a','71d0a9c0-d539-487e-8d32-8af4dd7d5120','Coach cannot delegate');
    RAISE EXCEPTION 'coach delegation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT count(*) INTO n FROM public.clinic_tasks;
  IF n <> 2 THEN RAISE EXCEPTION 'coach: own and assigned task visibility incorrect'; END IF;
END;
$test$;

-- Admin sees all three tasks after coach creates a personal one.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.clinic_tasks) <> 3 THEN
    RAISE EXCEPTION 'admin: team task board visibility incorrect';
  END IF;
END;
$test$;

-- Patient and platform owner cannot read or write staff tasks.
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
    RAISE EXCEPTION 'owner: clinic task board must not be exposed';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'clinic_task_delegation_rls_staging: PASS' AS result;
