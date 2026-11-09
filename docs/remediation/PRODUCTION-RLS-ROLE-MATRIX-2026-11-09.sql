-- Smart Diet v2 — Production RLS role matrix
-- Date: 2026-11-09
-- Run against a Supabase project with the current Smart Diet v2 schema.
-- SAFETY: all fixture rows and auth.users are created inside one transaction.
-- The final statement is ROLLBACK. Do not replace it with COMMIT.
-- This is an integration smoke matrix, not a substitute for the complete 33-case
-- Staging suite. It covers 31 production role-boundary assertions.

BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id::text LIKE 'c0000000-%')
     OR EXISTS (SELECT 1 FROM public.clinics WHERE id LIKE 'sdv2-smoke-%')
     OR EXISTS (SELECT 1 FROM public.platform_config WHERE key LIKE 'sdv2_smoke_%')
     OR EXISTS (SELECT 1 FROM public.invitations WHERE email LIKE 'sdv2-%@example.invalid') THEN
    RAISE EXCEPTION 'Synthetic RLS fixture identifiers already exist; refusing to run';
  END IF;
END
$guard$;

-- Synthetic Auth identities only; no credentials are created.
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
('c0000000-0000-4000-8000-000000000001','authenticated','authenticated','sdv2-owner@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000002','authenticated','authenticated','sdv2-admin-a@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000003','authenticated','authenticated','sdv2-coach-a@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000004','authenticated','authenticated','sdv2-coach-b@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000005','authenticated','authenticated','sdv2-patient-a@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000006','authenticated','authenticated','sdv2-patient-b@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000007','authenticated','authenticated','sdv2-admin-b@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000008','authenticated','authenticated','sdv2-patient-c@example.invalid','{}','{}',now(),now()),
('c0000000-0000-4000-8000-000000000009','authenticated','authenticated','sdv2-invitee@example.invalid','{}','{}',now(),now());

INSERT INTO public.clinics(id,name,owner_uid,owner_name,owner_phone,status)
VALUES
('sdv2-smoke-a','Smoke Clinic A','c0000000-0000-4000-8000-000000000001','Synthetic Owner','', 'active'),
('sdv2-smoke-b','Smoke Clinic B','c0000000-0000-4000-8000-000000000001','Synthetic Owner','', 'active');

INSERT INTO public.profiles(id,role,clinic_id,email,display_name,disabled)
VALUES
('c0000000-0000-4000-8000-000000000001','owner','platform','sdv2-owner@example.invalid','Synthetic Owner',false),
('c0000000-0000-4000-8000-000000000002','admin','sdv2-smoke-a','sdv2-admin-a@example.invalid','Synthetic Admin A',false),
('c0000000-0000-4000-8000-000000000003','coach','sdv2-smoke-a','sdv2-coach-a@example.invalid','Synthetic Coach A',false),
('c0000000-0000-4000-8000-000000000004','coach','sdv2-smoke-a','sdv2-coach-b@example.invalid','Synthetic Coach B',false),
('c0000000-0000-4000-8000-000000000005','patient','sdv2-smoke-a','sdv2-patient-a@example.invalid','Synthetic Patient A',false),
('c0000000-0000-4000-8000-000000000006','patient','sdv2-smoke-a','sdv2-patient-b@example.invalid','Synthetic Patient B',false),
('c0000000-0000-4000-8000-000000000007','admin','sdv2-smoke-b','sdv2-admin-b@example.invalid','Synthetic Admin B',false),
('c0000000-0000-4000-8000-000000000008','patient','sdv2-smoke-b','sdv2-patient-c@example.invalid','Synthetic Patient C',false);

INSERT INTO public.clinic_subscriptions(clinic_id,plan,status,start_at,expires_at,grace_ends_at,payments)
VALUES
('sdv2-smoke-a','monthly','active',now(),now()+interval '30 days',now()+interval '37 days','[]'),
('sdv2-smoke-b','monthly','active',now(),now()+interval '30 days',now()+interval '37 days','[]');

INSERT INTO public.patients(id,clinic_id,profile,plan,invited_by)
VALUES
('c0000000-0000-4000-8000-000000000005','sdv2-smoke-a','{}','{}','c0000000-0000-4000-8000-000000000003'),
('c0000000-0000-4000-8000-000000000006','sdv2-smoke-a','{}','{}','c0000000-0000-4000-8000-000000000004'),
('c0000000-0000-4000-8000-000000000008','sdv2-smoke-b','{}','{}','c0000000-0000-4000-8000-000000000007');

INSERT INTO public.day_logs(id,patient_id,log_date,log,created_at)
VALUES
(900000000000001,'c0000000-0000-4000-8000-000000000005',current_date,'{}',now()),
(900000000000002,'c0000000-0000-4000-8000-000000000006',current_date,'{}',now()),
(900000000000003,'c0000000-0000-4000-8000-000000000008',current_date,'{}',now());

INSERT INTO public.adherence_configs(patient_id,axes,updated_by)
VALUES ('c0000000-0000-4000-8000-000000000005','[]','c0000000-0000-4000-8000-000000000003');
INSERT INTO public.adherence_scores(id,patient_id,score_date,scores,overall,entered_by)
VALUES (900000000000001,'c0000000-0000-4000-8000-000000000005',current_date,'[]',85,'c0000000-0000-4000-8000-000000000003');
INSERT INTO public.consents(id,patient_id,purpose,consent,granted_by)
VALUES (900000000000001,'c0000000-0000-4000-8000-000000000005','sync','{"granted":true}','c0000000-0000-4000-8000-000000000005');
INSERT INTO public.fcm_tokens(patient_id,tokens)
VALUES ('c0000000-0000-4000-8000-000000000005',ARRAY['synthetic-token']);
INSERT INTO public.invitations(email,role,clinic_id,created_by,status)
VALUES ('sdv2-invitee@example.invalid','patient','sdv2-smoke-a','c0000000-0000-4000-8000-000000000002','pending');
INSERT INTO public.platform_config(key,value)
VALUES
('sdv2_smoke_public','{"public":"true","smoke":true}'),
('sdv2_smoke_private','{"public":"false","smoke":true}');

CREATE TEMP TABLE sdv2_rls_results (
  assertion text NOT NULL,
  expected boolean NOT NULL,
  actual boolean NOT NULL,
  detail text NOT NULL DEFAULT ''
);
GRANT ALL ON sdv2_rls_results TO anon, authenticated;

-- ANON: only public platform configuration is visible.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
INSERT INTO sdv2_rls_results
SELECT 'anon reads public platform config',true,count(*)=1,'public row count='||count(*)
FROM public.platform_config WHERE key='sdv2_smoke_public';
INSERT INTO sdv2_rls_results
SELECT 'anon cannot read private platform config',true,count(*)=0,'private row count='||count(*)
FROM public.platform_config WHERE key='sdv2_smoke_private';
INSERT INTO sdv2_rls_results
SELECT 'anon cannot SELECT profiles table',true,NOT has_table_privilege('anon','public.profiles','SELECT'),'table privilege check';

RESET ROLE;
SET LOCAL ROLE authenticated;

-- OWNER: all clinics, subscriptions and private configuration.
SELECT set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","email":"sdv2-owner@example.invalid"}',true);
INSERT INTO sdv2_rls_results
SELECT 'owner sees all synthetic profiles',true,count(*)=8,'visible='||count(*) FROM public.profiles WHERE id::text LIKE 'c0000000-%';
INSERT INTO sdv2_rls_results
SELECT 'owner sees both clinics',true,count(*)=2,'visible='||count(*) FROM public.clinics WHERE id LIKE 'sdv2-smoke-%';
INSERT INTO sdv2_rls_results
SELECT 'owner sees both subscriptions',true,count(*)=2,'visible='||count(*) FROM public.clinic_subscriptions WHERE clinic_id LIKE 'sdv2-smoke-%';
INSERT INTO sdv2_rls_results
SELECT 'owner sees private platform config',true,count(*)=1,'private rows='||count(*) FROM public.platform_config WHERE key='sdv2_smoke_private';
WITH changed AS (
 UPDATE public.clinic_subscriptions SET plan='annual' WHERE clinic_id='sdv2-smoke-a' RETURNING clinic_id
)
INSERT INTO sdv2_rls_results SELECT 'owner can update subscription',true,count(*)=1,'updated='||count(*) FROM changed;

RESET ROLE;
SET LOCAL ROLE authenticated;

-- ADMIN A: own clinic roster and clinic updates, but no subscription updates.
SELECT set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated","email":"sdv2-admin-a@example.invalid"}',true);
INSERT INTO sdv2_rls_results
SELECT 'admin A sees profiles in own clinic',true,count(*)=5,'visible='||count(*) FROM public.profiles WHERE id::text LIKE 'c0000000-%';
INSERT INTO sdv2_rls_results
SELECT 'admin A cannot see other-clinic admin profile',true,count(*)=0,'visible='||count(*) FROM public.profiles WHERE id='c0000000-0000-4000-8000-000000000007';
INSERT INTO sdv2_rls_results
SELECT 'admin A sees own clinic only',true,count(*)=1,'visible='||count(*) FROM public.clinics WHERE id LIKE 'sdv2-smoke-%';
INSERT INTO sdv2_rls_results
SELECT 'admin A sees own subscription only',true,count(*)=1,'visible='||count(*) FROM public.clinic_subscriptions WHERE clinic_id LIKE 'sdv2-smoke-%';
WITH changed AS (
 UPDATE public.clinics SET name='Smoke Clinic A Updated' WHERE id='sdv2-smoke-a' RETURNING id
)
INSERT INTO sdv2_rls_results SELECT 'admin A can update own clinic',true,count(*)=1,'updated='||count(*) FROM changed;
WITH changed AS (
 UPDATE public.clinic_subscriptions SET plan='annual' WHERE clinic_id='sdv2-smoke-a' RETURNING clinic_id
)
INSERT INTO sdv2_rls_results SELECT 'admin A cannot update subscription',true,count(*)=0,'updated='||count(*) FROM changed;

RESET ROLE;
SET LOCAL ROLE authenticated;

-- COACH A: only self and assigned patient; no clinic write permission.
SELECT set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","email":"sdv2-coach-a@example.invalid"}',true);
INSERT INTO sdv2_rls_results
SELECT 'coach A sees only own profile',true,count(*)=1,'visible='||count(*) FROM public.profiles WHERE id::text LIKE 'c0000000-%';
INSERT INTO sdv2_rls_results
SELECT 'coach A sees assigned patient A only',true,count(*)=1,'visible='||count(*) FROM public.patients WHERE id::text LIKE 'c0000000-%';
INSERT INTO sdv2_rls_results
SELECT 'coach A sees assigned patient A day log only',true,count(*)=1,'visible='||count(*) FROM public.day_logs WHERE id>=900000000000001;
WITH changed AS (
 UPDATE public.patients SET profile=profile||'{"smoke":"updated"}' WHERE id='c0000000-0000-4000-8000-000000000005' RETURNING id
)
INSERT INTO sdv2_rls_results SELECT 'coach A can update assigned patient',true,count(*)=1,'updated='||count(*) FROM changed;
WITH changed AS (
 UPDATE public.patients SET profile=profile||'{"smoke":"blocked"}' WHERE id='c0000000-0000-4000-8000-000000000006' RETURNING id
)
INSERT INTO sdv2_rls_results SELECT 'coach A cannot update another coach patient',true,count(*)=0,'updated='||count(*) FROM changed;
WITH changed AS (
 UPDATE public.clinics SET name='Unauthorized' WHERE id='sdv2-smoke-a' RETURNING id
)
INSERT INTO sdv2_rls_results SELECT 'coach A cannot update clinic',true,count(*)=0,'updated='||count(*) FROM changed;

RESET ROLE;
SET LOCAL ROLE authenticated;

-- PATIENT A: own clinical rows only; no staff-level write access.
SELECT set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000005","role":"authenticated","email":"sdv2-patient-a@example.invalid"}',true);
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own profile only',true,count(*)=1,'visible='||count(*) FROM public.profiles WHERE id::text LIKE 'c0000000-%';
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own patient record only',true,count(*)=1,'visible='||count(*) FROM public.patients WHERE id::text LIKE 'c0000000-%';
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own day log only',true,count(*)=1,'visible='||count(*) FROM public.day_logs WHERE id>=900000000000001;
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own adherence config',true,count(*)=1,'visible='||count(*) FROM public.adherence_configs WHERE patient_id='c0000000-0000-4000-8000-000000000005';
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own adherence score',true,count(*)=1,'visible='||count(*) FROM public.adherence_scores WHERE patient_id='c0000000-0000-4000-8000-000000000005';
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own consent',true,count(*)=1,'visible='||count(*) FROM public.consents WHERE patient_id='c0000000-0000-4000-8000-000000000005';
INSERT INTO sdv2_rls_results
SELECT 'patient A sees own FCM token',true,count(*)=1,'visible='||count(*) FROM public.fcm_tokens WHERE patient_id='c0000000-0000-4000-8000-000000000005';
INSERT INTO sdv2_rls_results
SELECT 'patient A cannot see patient B',true,count(*)=0,'visible='||count(*) FROM public.patients WHERE id='c0000000-0000-4000-8000-000000000006';
WITH changed AS (
 UPDATE public.patients SET profile=profile||'{"smoke":"patient-write"}' WHERE id='c0000000-0000-4000-8000-000000000005' RETURNING id
)
INSERT INTO sdv2_rls_results SELECT 'patient A cannot update own patient row',true,count(*)=0,'updated='||count(*) FROM changed;

DO $block$
BEGIN
  BEGIN
    INSERT INTO public.adherence_configs(patient_id,axes,updated_by)
    VALUES ('c0000000-0000-4000-8000-000000000005','[]','c0000000-0000-4000-8000-000000000005');
    INSERT INTO sdv2_rls_results VALUES ('patient A cannot write adherence config',true,false,'INSERT unexpectedly succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO sdv2_rls_results VALUES ('patient A cannot write adherence config',true,true,'RLS correctly denied INSERT');
  END;
END
$block$;

RESET ROLE;
SET LOCAL ROLE authenticated;

-- INVITEE: exact pending invitation permits profile creation and consumption.
SELECT set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000009","role":"authenticated","email":"sdv2-invitee@example.invalid"}',true);
INSERT INTO public.profiles(id,role,clinic_id,email,display_name,disabled)
VALUES ('c0000000-0000-4000-8000-000000000009','patient','sdv2-smoke-a','sdv2-invitee@example.invalid','Synthetic Invitee',false);
UPDATE public.invitations SET status='consumed' WHERE email='sdv2-invitee@example.invalid' AND status='pending';
INSERT INTO sdv2_rls_results
SELECT 'invitee can claim matching invitation and profile',true,
  (SELECT count(*)=1 FROM public.profiles WHERE id='c0000000-0000-4000-8000-000000000009')
  AND (SELECT count(*)=1 FROM public.invitations WHERE email='sdv2-invitee@example.invalid' AND status='consumed'),
  'profile created and invite consumed';

RESET ROLE;
SELECT count(*) AS assertions,
       count(*) FILTER (WHERE expected=actual) AS passed,
       count(*) FILTER (WHERE expected<>actual) AS failed,
       json_agg(json_build_object('assertion',assertion,'expected',expected,'actual',actual,'detail',detail) ORDER BY assertion) AS results
FROM sdv2_rls_results;

-- Mandatory cleanup: all synthetic data and Auth records are rolled back.
ROLLBACK;
