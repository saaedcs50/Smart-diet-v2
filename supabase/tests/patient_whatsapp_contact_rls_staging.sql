-- WhatsApp contact consent and RLS regression; synthetic Staging only.
-- All changes are rolled back.
-- clinic-a admin: 71d0a9c0-d539-487e-8d32-8af4dd7d5120
-- clinic-a coach: 809f256f-0a4c-4b1e-af92-a26dd21d7623
-- clinic-a assigned patient: f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8
-- clinic-b patient: d4391923-54a7-4c5a-94b5-3782ff7d1e79

BEGIN;
SET LOCAL ROLE authenticated;

-- Assigned coach can record consent and a canonical Egyptian mobile number.
SELECT set_config('request.jwt.claim.sub','809f256f-0a4c-4b1e-af92-a26dd21d7623',true);
SELECT set_config('request.jwt.claims','{"sub":"809f256f-0a4c-4b1e-af92-a26dd21d7623","role":"authenticated"}',true);

DO $test$
DECLARE n integer;
BEGIN
  UPDATE public.patients
  SET whatsapp_phone='201012345678',
      whatsapp_consent_at=now(),
      whatsapp_consent_by=auth.uid()
  WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8'
    AND clinic_id='clinic-a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'assigned coach could not update patient contact'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8'
      AND whatsapp_phone='201012345678'
      AND whatsapp_consent_at IS NOT NULL
      AND whatsapp_consent_by=auth.uid()
  ) THEN RAISE EXCEPTION 'contact or consent was not saved'; END IF;

  UPDATE public.patients
  SET whatsapp_phone='201012345678',
      whatsapp_consent_at=now(),
      whatsapp_consent_by=auth.uid()
  WHERE id='d4391923-54a7-4c5a-94b5-3782ff7d1e79';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'coach modified patient from another clinic'; END IF;

  BEGIN
    UPDATE public.patients
    SET whatsapp_phone='201312345678',
        whatsapp_consent_at=now(),
        whatsapp_consent_by=auth.uid()
    WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
    RAISE EXCEPTION 'invalid Egyptian mobile number was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.patients
    SET whatsapp_phone='201012345678',
        whatsapp_consent_at=NULL,
        whatsapp_consent_by=NULL
    WHERE id='f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8';
    RAISE EXCEPTION 'contact without consent was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$test$;

-- Patients cannot update the clinic-owned contact record on their own row.
SELECT set_config('request.jwt.claim.sub','f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8',true);
SELECT set_config('request.jwt.claims','{"sub":"f3a2de27-1951-4b9d-9f3a-c8d830f3b0e8","role":"authenticated"}',true);
DO $test$
DECLARE n integer;
BEGIN
  UPDATE public.patients
  SET whatsapp_phone='201112345678',
      whatsapp_consent_at=now(),
      whatsapp_consent_by=auth.uid()
  WHERE id=auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'patient modified clinic-recorded WhatsApp consent'; END IF;
END;
$test$;

ROLLBACK;
SELECT 'patient_whatsapp_contact_rls: PASS' AS result;
