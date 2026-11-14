-- Smart Diet v2: executable RLS role matrix for the synthetic Staging project.
-- Run only against Staging, using a SQL Editor/connection with permission to
-- impersonate authenticated/anon and insert rollback-only fixtures.
-- Every operation is inside one transaction and ends in ROLLBACK.
--
-- Synthetic Staging identities (2026-11-13):
-- owner:   0b8b9208-bd7f-4d26-9613-e35dd277d066
-- admin:   71d0a9c0-d539-487e-8d32-8af4dd7d5120 (clinic-a)
-- coach:   809f256f-0a4c-4b1e-af92-a26dd21d7623 (clinic-a)
-- patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8 (clinic-a, assigned to coach)
-- patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79 (clinic-b)
--
-- Matrix tables: profiles, clinics, clinic_subscriptions, platform_config,
-- invitations, patients, day_logs, adherence_configs, adherence_scores,
-- fcm_tokens, consents.

BEGIN;
SET LOCAL ROLE authenticated;

-- OWNER: complete platform visibility and owner-only update paths.
SELECT set_config('request.jwt.claim.sub','0b8b9208-bd7f-4d26-9613-e35dd277d066',true);
DO $test$
DECLARE n integer;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 6 THEN RAISE EXCEPTION 'owner: profiles'; END IF;
  IF (SELECT count(*) FROM public.clinics) <> 2 THEN RAISE EXCEPTION 'owner: clinics'; END IF;
  IF (SELECT count(*) FROM public.clinic_subscriptions) <> 2 THEN RAISE EXCEPTION 'owner: subscriptions'; END IF;
  IF (SELECT count(*) FROM public.platform_config) <> 2 THEN RAISE EXCEPTION 'owner: platform_config'; END IF;
  IF (SELECT count(*) FROM public.invitations) <> 1 THEN RAISE EXCEPTION 'owner: invitations'; END IF;
  IF (SELECT count(*) FROM public.patients) <> 2 THEN RAISE EXCEPTION 'owner: patients'; END IF;
  IF (SELECT count(*) FROM public.day_logs) <> 1 THEN RAISE EXCEPTION 'owner: day_logs'; END IF;
  UPDATE public.clinics SET name = name WHERE id = 'clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'owner: clinic update'; END IF;
  UPDATE public.clinic_subscriptions SET status = status WHERE clinic_id = 'clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'owner: subscription update'; END IF;
END;
$test$;

-- ADMIN clinic-a: clinic-scoped visibility, but no clinic metadata/owner control.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
DO $test$
DECLARE n integer;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 4 THEN RAISE EXCEPTION 'admin: profiles scope'; END IF;
  IF (SELECT count(*) FROM public.clinics) <> 1 THEN RAISE EXCEPTION 'admin: clinics scope'; END IF;
  IF (SELECT count(*) FROM public.clinic_subscriptions) <> 1 THEN RAISE EXCEPTION 'admin: subscriptions scope'; END IF;
  IF (SELECT count(*) FROM public.platform_config) <> 1 THEN RAISE EXCEPTION 'admin: public config only'; END IF;
  IF (SELECT count(*) FROM public.patients) <> 1 THEN RAISE EXCEPTION 'admin: patients scope'; END IF;
  UPDATE public.clinics SET status = 'suspended' WHERE id = 'clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'admin: changed clinic status'; END IF;
  UPDATE public.clinics SET owner_uid = 'attacker' WHERE id = 'clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'admin: changed clinic owner'; END IF;
  UPDATE public.profiles SET display_name = display_name
  WHERE id = '71d0a9c0-d539-487e-8d32-8af4dd7d5120';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'admin: profile update must be denied'; END IF;
  BEGIN
    UPDATE public.clinic_subscriptions SET status = 'expired' WHERE clinic_id = 'clinic-a';
    RAISE EXCEPTION 'admin: subscription status edit unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test$;

-- COACH clinic-a: only the patient assigned to this coach is visible/editable.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
DO $test$
DECLARE n integer;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'coach: profile self only'; END IF;
  IF (SELECT count(*) FROM public.patients) <> 1 THEN RAISE EXCEPTION 'coach: assigned patient only'; END IF;
  IF EXISTS (SELECT 1 FROM public.patients WHERE id='d4391923-54a7-4c5a-94b5-3782ff7d1e79') THEN
    RAISE EXCEPTION 'coach: cross-clinic patient visible';
  END IF;
  UPDATE public.patients SET profile = profile
  WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned patient update'; END IF;
  UPDATE public.patients SET profile = profile
  WHERE id = 'd4391923-54a7-4c5a-94b5-3782ff7d1e79';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: cross-clinic patient update'; END IF;
  UPDATE public.clinics SET name = name WHERE id='clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach: clinic update must be denied'; END IF;

  INSERT INTO public.invitations(email,role,clinic_id,created_by,status)
  VALUES ('rls-coach-matrix@example.test','patient','clinic-a',
    '809f256f-0a4c-4b1e-af92-a26dd21d7623','pending');
  INSERT INTO public.adherence_configs(patient_id,axes,updated_by)
  VALUES ('f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','[]'::jsonb,
    '809f256f-0a4c-4b1e-af92-a26dd21d7623');
  INSERT INTO public.adherence_scores(patient_id,score_date,scores,overall,entered_by,note)
  VALUES ('f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','2099-12-31','[]'::jsonb,80,
    '809f256f-0a4c-4b1e-af92-a26dd21d7623','RLS matrix test');
END;
$test$;

-- PATIENT clinic-a: own patient/day data, no clinic subscription table or payments.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
DO $test$
DECLARE n integer; gate_status text;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'patient-a: profile self only'; END IF;
  IF (SELECT count(*) FROM public.patients) <> 1 THEN RAISE EXCEPTION 'patient-a: patient self only'; END IF;
  IF (SELECT count(*) FROM public.day_logs) <> 1 THEN RAISE EXCEPTION 'patient-a: day log self only'; END IF;
  IF (SELECT count(*) FROM public.clinic_subscriptions) <> 0 THEN RAISE EXCEPTION 'patient-a: direct subscription read leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.patients WHERE id='d4391923-54a7-4c5a-94b5-3782ff7d1e79') THEN
    RAISE EXCEPTION 'patient-a: cross-clinic patient visible';
  END IF;
  SELECT status INTO gate_status
  FROM public.get_clinic_subscription_gate('clinic-a');
  IF gate_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'patient-a: safe subscription gate expected active';
  END IF;

  INSERT INTO public.day_logs(patient_id,log_date,log)
  VALUES ('f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','2099-12-31','{}'::jsonb);
  INSERT INTO public.fcm_tokens(patient_id,tokens)
  VALUES ('f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',ARRAY['rls-matrix-token']);
  INSERT INTO public.consents(patient_id,purpose,consent,granted_by)
  VALUES ('f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8','rls-matrix-test',
    '{"granted":true}'::jsonb,'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8');

  UPDATE public.patients SET profile=profile
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'patient-a: patients table update must be denied'; END IF;
END;
$test$;

-- PATIENT clinic-b: own patient row only, no clinic-a day logs or subscription data.
SELECT set_config('request.jwt.claim.sub','d4391923-54a7-4c5a-94b5-3782ff7d1e79',true);
DO $test$
DECLARE gate_status text;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'patient-b: profile self only'; END IF;
  IF (SELECT count(*) FROM public.patients) <> 1 THEN RAISE EXCEPTION 'patient-b: patient self only'; END IF;
  IF (SELECT count(*) FROM public.day_logs) <> 0 THEN RAISE EXCEPTION 'patient-b: another patient day log visible'; END IF;
  IF (SELECT count(*) FROM public.clinic_subscriptions) <> 0 THEN RAISE EXCEPTION 'patient-b: direct subscription read leaked'; END IF;
  SELECT status INTO gate_status
  FROM public.get_clinic_subscription_gate('clinic-b');
  IF gate_status IS DISTINCT FROM 'grace' THEN
    RAISE EXCEPTION 'patient-b: safe subscription gate expected grace';
  END IF;
  IF (SELECT count(*) FROM public.get_clinic_subscription_gate('clinic-a')) <> 0 THEN
    RAISE EXCEPTION 'patient-b: cross-clinic gate lookup succeeded';
  END IF;
END;
$test$;

-- DISABLED COACH: the profile row can be inspected, but no operational data remains accessible.
RESET ROLE;
UPDATE public.profiles SET disabled=true
WHERE id='809f256f-0a4c-4b1e-af92-a26dd21d7623';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patients) <> 0 THEN RAISE EXCEPTION 'disabled coach: patients visible'; END IF;
  IF (SELECT count(*) FROM public.day_logs) <> 0 THEN RAISE EXCEPTION 'disabled coach: day logs visible'; END IF;
  IF (SELECT count(*) FROM public.clinics) <> 0 THEN RAISE EXCEPTION 'disabled coach: clinic visible'; END IF;
  IF (SELECT count(*) FROM public.clinic_subscriptions) <> 0 THEN RAISE EXCEPTION 'disabled coach: subscription visible'; END IF;
  IF (SELECT count(*) FROM public.get_clinic_subscription_gate('clinic-a')) <> 0 THEN
    RAISE EXCEPTION 'disabled coach: subscription gate accessible';
  END IF;
END;
$test$;

-- SUSPENDED CLINIC: an active subscription does not bypass suspension.
RESET ROLE;
UPDATE public.profiles SET disabled=false
WHERE id='809f256f-0a4c-4b1e-af92-a26dd21d7623';
UPDATE public.clinics SET status='suspended' WHERE id='clinic-a';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patients) <> 0 THEN RAISE EXCEPTION 'suspended clinic: patients visible'; END IF;
  IF (SELECT count(*) FROM public.day_logs) <> 0 THEN RAISE EXCEPTION 'suspended clinic: day logs visible'; END IF;
  IF (SELECT count(*) FROM public.get_clinic_subscription_gate('clinic-a')) <> 0 THEN
    RAISE EXCEPTION 'suspended clinic: subscription gate accessible';
  END IF;
END;
$test$;

-- Anonymous access: only the explicitly public platform configuration is visible.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.platform_config) <> 1 THEN
    RAISE EXCEPTION 'anon: expected public config only';
  END IF;
END;
$test$;

ROLLBACK;
