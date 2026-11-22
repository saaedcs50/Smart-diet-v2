-- Consent-recorded Egyptian WhatsApp contact for patient reactivation messages.
BEGIN;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_by uuid
    REFERENCES public.profiles(id) ON DELETE RESTRICT;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='patients_whatsapp_phone_egyptian_check'
      AND conrelid='public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_whatsapp_phone_egyptian_check
      CHECK (
        whatsapp_phone IS NULL
        OR whatsapp_phone ~ '^201[0125][0-9]{8}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='patients_whatsapp_consent_pair_check'
      AND conrelid='public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_whatsapp_consent_pair_check
      CHECK (
        (
          whatsapp_phone IS NULL
          AND whatsapp_consent_at IS NULL
          AND whatsapp_consent_by IS NULL
        )
        OR
        (
          whatsapp_phone IS NOT NULL
          AND whatsapp_consent_at IS NOT NULL
          AND whatsapp_consent_by IS NOT NULL
        )
      );
  END IF;
END;
$constraints$;

COMMENT ON COLUMN public.patients.whatsapp_phone IS
  'Canonical Egyptian mobile number in international digits, only stored when WhatsApp follow-up consent is recorded.';
COMMENT ON COLUMN public.patients.whatsapp_consent_at IS
  'Timestamp when clinic staff recorded the patient consent to receive WhatsApp follow-up messages.';
COMMENT ON COLUMN public.patients.whatsapp_consent_by IS
  'Clinic staff profile that recorded the patient WhatsApp follow-up consent.';

COMMIT;
