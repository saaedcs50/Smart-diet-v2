-- Patient daily journal staff-comment access regression. Synthetic Staging only.
-- All comments are rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a assigned patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79
-- platform owner: 0b8b9208-bd7f-4d26-9613-e35dd277d066

BEGIN;

-- Seed one synthetic daily journal row inside the same transaction.
INSERT INTO public.day_logs (patient_id, log_date, log)
VALUES (
  'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
  '2026-11-22',
  '{"water":0,"waterLogs":0,"meals":{},"checks":{},"supps":{},"notes":"","weight":null,"meas":{},"symptoms":{},"symNotes":"","mood":null,"exercise":0,"isFreeze":false}'::jsonb
)
ON CONFLICT (patient_id, log_date) DO NOTHING;

SET LOCAL ROLE authenticated;

-- Assigned coach can add a plain-text note to a patient journal date.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE comment_id uuid; n integer;
BEGIN
  INSERT INTO public.patient_log_comments (
    clinic_id, patient_id, log_date, content
  ) VALUES (
    'clinic-a',
    'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
    '2026-11-22',
    'ملاحظة متابعة تجريبية'
  ) RETURNING id INTO comment_id;
  PERFORM set_config('test.patient_comment_id', comment_id::text, true);

  SELECT count(*) INTO n FROM public.patient_log_comments
  WHERE id=comment_id AND created_by=auth.uid();
  IF n <> 1 THEN RAISE EXCEPTION 'coach: comment insert/read failed'; END IF;

  BEGIN
    INSERT INTO public.patient_log_comments (
      clinic_id, patient_id, log_date, content
    ) VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '2099-12-31',
      'Comment cannot reference a missing journal date'
    );
    RAISE EXCEPTION 'comment without a daily journal entry was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.patient_log_comments (
      clinic_id, patient_id, log_date, content
    ) VALUES (
      'clinic-b',
      'd4391923-54a7-4c5a-94b5-3782ff7d1e79',
      '2026-11-22',
      'Cross-clinic comment must fail'
    );
    RAISE EXCEPTION 'coach inserted cross-clinic comment';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.patient_log_comments (
      clinic_id, patient_id, log_date, content
    ) VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '2026-11-22',
      '   '
    );
    RAISE EXCEPTION 'blank comment unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.patient_log_comments (
      clinic_id, patient_id, log_date, content
    ) VALUES (
      'clinic-a',
      'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',
      '2026-11-22',
      repeat('x', 1201)
    );
    RAISE EXCEPTION 'oversized comment unexpectedly accepted';
  EXCEPTION WHEN string_data_right_truncation OR check_violation THEN
    NULL;
  END;
END;
$test$;

-- Patient can read their own comment but cannot add a staff comment.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.patient_log_comments;
  IF n <> 1 THEN RAISE EXCEPTION 'patient: own clinic comment is not visible'; END IF;

  BEGIN
    INSERT INTO public.patient_log_comments (
      clinic_id, patient_id, log_date, content
    ) VALUES (
      'clinic-a',
      auth.uid(),
      '2026-11-22',
      'Patient must not create staff comment'
    );
    RAISE EXCEPTION 'patient inserted staff comment';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- Admin sees clinic-a comments; owner cannot read the table.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_log_comments) <> 1 THEN
    RAISE EXCEPTION 'admin: clinic comment visibility failed';
  END IF;
END;
$test$;

SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
SELECT set_config('request.jwt.claims','{"sub":"0b8b9208-bd7f-4d26-9613-e35dd277d066","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_log_comments) <> 0 THEN
    RAISE EXCEPTION 'owner: patient journal comments must not be exposed';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'patient_log_comments_rls_staging: PASS' AS result;
