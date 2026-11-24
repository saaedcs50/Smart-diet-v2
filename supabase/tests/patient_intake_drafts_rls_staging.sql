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
  VALUES (
    assigned_id,
    '{"clientName":"Assigned draft","dailyWaterGoalMl":2000,"meals":[],"checklist":[],"adminPin":"legacy-pin"}'::jsonb
  );

  SELECT count(*) INTO n FROM public.patient_intake_drafts;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: assigned draft visibility failed'; END IF;

  BEGIN
    PERFORM public.approve_patient_intake_draft(assigned_id);
    RAISE EXCEPTION 'coach approved an intake before reviewing it';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;

  SELECT count(*) INTO n FROM public.patient_intake_drafts
  WHERE intake_id = assigned_id AND status = 'draft';
  IF n <> 1 THEN RAISE EXCEPTION 'approval-before-review changed draft state'; END IF;


  UPDATE public.patient_intake_drafts
  SET draft_plan = '{"clientName":"Updated assigned draft","dailyWaterGoalMl":2000,"meals":[],"checklist":[],"adminPin":"legacy-pin"}'::jsonb,
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


-- Approval is allowed only after the intake review and applies the plan and
-- draft status atomically. A second approval is rejected.
DO $test$
DECLARE
  n integer;
  approved jsonb;
  assigned_id uuid := current_setting('test.draft_assigned_intake_id')::uuid;
  patient_id uuid := 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  patient_plan jsonb;
BEGIN
  UPDATE public.patient_intakes
     SET status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = auth.uid()
   WHERE id = assigned_id
     AND status = 'submitted';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'coach: intake review prerequisite failed'; END IF;

  -- A direct status-only update must fail because the active patient plan
  -- does not yet match the draft content.
  BEGIN
    UPDATE public.patient_intake_drafts
       SET status = 'approved',
           approved_at = now(),
           approved_by = auth.uid(),
           updated_at = now(),
           updated_by = auth.uid()
     WHERE intake_id = assigned_id;
    RAISE EXCEPTION 'coach approved a draft without applying it to patients.plan';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  approved := public.approve_patient_intake_draft(assigned_id);
  IF approved->>'status' <> 'approved' THEN
    RAISE EXCEPTION 'approval RPC did not return approved status';
  END IF;

  SELECT plan INTO patient_plan
    FROM public.patients
   WHERE id = patient_id;
  IF patient_plan->>'clientName' <> 'Updated assigned draft' THEN
    RAISE EXCEPTION 'approved draft was not copied to the active patient plan';
  END IF;
  IF patient_plan ? 'adminPin' THEN
    RAISE EXCEPTION 'legacy adminPin must not be restored by plan approval';
  END IF;

  SELECT count(*) INTO n
    FROM public.patient_intake_drafts
   WHERE intake_id = assigned_id
     AND status = 'approved'
     AND approved_by = auth.uid()
     AND draft_plan = patient_plan;
  IF n <> 1 THEN
    RAISE EXCEPTION 'draft approval and active plan were not committed together';
  END IF;

  BEGIN
    PERFORM public.approve_patient_intake_draft(assigned_id);
    RAISE EXCEPTION 'an approved draft was approved a second time';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
END;
$test$;

-- Build a second reviewed draft against the current plan, then change the plan.
-- Approval must reject the stale version and leave the newer active plan untouched.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
DECLARE intake_id uuid;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-a',
    auth.uid(),
    '{"clientName":"Stale-plan synthetic patient","conditions":[],"allergies":[],"medicationsText":"","notes":"Stale approval test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.draft_stale_intake_id', intake_id::text, true);
END;
$test$;

SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);
DO $test$
DECLARE
  stale_id uuid := current_setting('test.draft_stale_intake_id')::uuid;
  base_version text;
  n integer;
BEGIN
  UPDATE public.patient_intakes
     SET status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = auth.uid()
   WHERE id = stale_id;

  SELECT plan->>'updatedAt'
    INTO base_version
    FROM public.patients
   WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';

  INSERT INTO public.patient_intake_drafts (
    intake_id, draft_plan, base_plan_updated_at
  )
  VALUES (
    stale_id,
    '{"clientName":"Stale draft must not publish","dailyWaterGoalMl":2000,"meals":[],"checklist":[]}'::jsonb,
    base_version
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'stale guard: test draft creation failed'; END IF;
END;
$test$;

-- Change the active plan after draft creation, as a clinic administrator.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
UPDATE public.patients
   SET plan = plan || jsonb_build_object(
     'clientName', 'Newer active plan must be preserved',
     'updatedAt', '2026-11-24T05:55:00.000Z'
   )
 WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';

-- Stale approval must fail and leave both rows unchanged.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);
DO $test$
DECLARE
  stale_id uuid := current_setting('test.draft_stale_intake_id')::uuid;
  n integer;
  current_name text;
BEGIN
  BEGIN
    PERFORM public.approve_patient_intake_draft(stale_id);
    RAISE EXCEPTION 'stale draft was approved over a newer active plan';
  EXCEPTION WHEN SQLSTATE '40001' THEN
    NULL;
  END;

  SELECT count(*) INTO n
    FROM public.patient_intake_drafts
   WHERE intake_id = stale_id AND status = 'draft';
  IF n <> 1 THEN RAISE EXCEPTION 'stale draft must remain unapproved'; END IF;

  SELECT plan->>'clientName'
    INTO current_name
    FROM public.patients
   WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  IF current_name <> 'Newer active plan must be preserved' THEN
    RAISE EXCEPTION 'stale approval overwrote the active plan';
  END IF;
END;
$test$;

-- Medication directions must be explicit before a draft can be approved.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
DECLARE intake_id uuid;
BEGIN
  INSERT INTO public.patient_intakes (clinic_id, patient_id, answers, consent_version)
  VALUES (
    'clinic-a',
    auth.uid(),
    '{"clientName":"Medication validation synthetic patient","conditions":[],"allergies":[],"medicationsText":"Example medicine","notes":"Medication approval test"}'::jsonb,
    'patient-intake-v1-2026-11-22'
  ) RETURNING id INTO intake_id;
  PERFORM set_config('test.draft_medication_intake_id', intake_id::text, true);
END;
$test$;

SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);
DO $test$
DECLARE
  medication_id uuid := current_setting('test.draft_medication_intake_id')::uuid;
  base_version text;
  n integer;
BEGIN
  UPDATE public.patient_intakes
     SET status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = auth.uid()
   WHERE id = medication_id;

  SELECT plan->>'updatedAt'
    INTO base_version
    FROM public.patients
   WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';

  INSERT INTO public.patient_intake_drafts (
    intake_id, draft_plan, base_plan_updated_at
  )
  VALUES (
    medication_id,
    '{
      "clientName":"Medication validation draft",
      "dailyWaterGoalMl":2000,
      "meals":[],
      "checklist":[],
      "medicationPlan":{
        "showToClient":false,
        "items":[{
          "id":"med-test-1",
          "name":"Example medicine",
          "dose":"500 mg",
          "timesPerDay":0,
          "timings":[],
          "active":true
        }]
      }
    }'::jsonb,
    base_version
  );

  BEGIN
    PERFORM public.approve_patient_intake_draft(medication_id);
    RAISE EXCEPTION 'draft with unspecified medication frequency was approved';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  UPDATE public.patient_intake_drafts
     SET draft_plan = jsonb_set(
       draft_plan,
       '{medicationPlan,items,0}',
       '{
         "id":"med-test-1",
         "name":"Example medicine",
         "dose":"500 mg",
         "timesPerDay":2,
         "timings":[
           {"id":"timing-1","slot":"morning","label":"صباحًا"}
         ],
         "active":true
       }'::jsonb
     ),
     updated_at = now(),
     updated_by = auth.uid()
   WHERE intake_id = medication_id
     AND status = 'draft';

  BEGIN
    PERFORM public.approve_patient_intake_draft(medication_id);
    RAISE EXCEPTION 'draft with an incomplete medication timing list was approved';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  SELECT count(*) INTO n
    FROM public.patient_intake_drafts
   WHERE intake_id = medication_id AND status = 'draft';
  IF n <> 1 THEN RAISE EXCEPTION 'invalid medication draft must remain unapproved'; END IF;

  IF (SELECT plan->>'clientName' FROM public.patients
       WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8')
       <> 'Newer active plan must be preserved' THEN
    RAISE EXCEPTION 'invalid medication approval modified the active patient plan';
  END IF;
END;
$test$;

-- Clinic admin can read clinic-a drafts. A patient and platform owner cannot.
SELECT set_config('request.jwt.claim.sub','71d0a9c0-d539-487e-8d32-8af4dd7d5120',true);
SELECT set_config('request.jwt.claims','{"sub":"71d0a9c0-d539-487e-8d32-8af4dd7d5120","role":"authenticated"}',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.patient_intake_drafts) <> 3 THEN
    RAISE EXCEPTION 'admin: clinic-wide draft visibility failed';
  END IF;
END;
$test$;

SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
DECLARE current_plan jsonb;
BEGIN
  IF (SELECT count(*) FROM public.patient_intake_drafts) <> 0 THEN
    RAISE EXCEPTION 'patient: staff-only drafts were visible';
  END IF;

  SELECT plan INTO current_plan
    FROM public.patients
   WHERE id = 'f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
  IF current_plan->>'clientName' <> 'Newer active plan must be preserved' THEN
    RAISE EXCEPTION 'patient: expected newer active plan was not visible';
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
