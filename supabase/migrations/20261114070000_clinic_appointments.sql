-- Clinic-scoped appointment scheduling foundation.
-- No clinical free-text notes are stored in this table.
BEGIN;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id text NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  visit_type text NOT NULL DEFAULT 'follow_up'
    CHECK (visit_type IN ('initial_consultation', 'follow_up', 'measurement_review')),
  channel text NOT NULL DEFAULT 'in_person'
    CHECK (channel IN ('in_person', 'video', 'phone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_valid_duration
    CHECK (ends_at > starts_at AND ends_at - starts_at >= interval '15 minutes'
      AND ends_at - starts_at <= interval '3 hours')
);

CREATE INDEX IF NOT EXISTS appointments_clinic_starts_at_idx
  ON public.appointments (clinic_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_provider_starts_at_idx
  ON public.appointments (provider_id, starts_at)
  WHERE status IN ('scheduled', 'confirmed');
CREATE INDEX IF NOT EXISTS appointments_patient_starts_at_idx
  ON public.appointments (patient_id, starts_at)
  WHERE status IN ('scheduled', 'confirmed');

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.appointments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.appointments TO authenticated;

DROP POLICY IF EXISTS appointments_select_scoped ON public.appointments;
CREATE POLICY appointments_select_scoped
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(appointments.clinic_id))
    AND (SELECT private.can_access_patient(appointments.patient_id))
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR (
        (SELECT private.caller_role()) = 'coach'
        AND provider_id = (SELECT auth.uid())
      )
      OR (
        (SELECT private.caller_role()) = 'patient'
        AND patient_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS appointments_insert_scoped ON public.appointments;
CREATE POLICY appointments_insert_scoped
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(appointments.clinic_id))
    AND (SELECT private.can_access_patient(appointments.patient_id))
    AND created_by = (SELECT auth.uid())
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR (
        (SELECT private.caller_role()) = 'coach'
        AND provider_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS appointments_update_scoped ON public.appointments;
CREATE POLICY appointments_update_scoped
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(appointments.clinic_id))
    AND (SELECT private.can_access_patient(appointments.patient_id))
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR (
        (SELECT private.caller_role()) = 'coach'
        AND provider_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    clinic_id = (SELECT private.caller_clinic_id())
    AND (SELECT private.clinic_sub_active(appointments.clinic_id))
    AND (SELECT private.can_access_patient(appointments.patient_id))
    AND (
      (SELECT private.caller_role()) = 'admin'
      OR (
        (SELECT private.caller_role()) = 'coach'
        AND provider_id = (SELECT auth.uid())
      )
    )
  );

-- This narrow trigger function is SECURITY DEFINER only because a coach's RLS
-- scope intentionally hides appointments assigned to other doctors. The
-- function returns no data; it only validates references and serializes
-- overlap checks for provider and patient using transaction-scoped locks.
CREATE OR REPLACE FUNCTION private.validate_appointment_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := private.caller_role();
  v_patient_clinic text;
  v_patient_invited_by uuid;
  v_provider_clinic text;
  v_provider_role text;
  v_provider_disabled boolean;
  v_provider_lock bigint;
  v_patient_lock bigint;
BEGIN
  IF v_uid IS NULL OR v_role NOT IN ('admin', 'coach') THEN
    RAISE EXCEPTION 'Only an enabled clinic admin or assigned doctor may manage appointments'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM private.caller_clinic_id()
     OR NOT private.clinic_sub_active(NEW.clinic_id) THEN
    RAISE EXCEPTION 'Appointment is outside the active clinic'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.clinic_id, p.invited_by
    INTO v_patient_clinic, v_patient_invited_by
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  IF NOT FOUND OR v_patient_clinic IS DISTINCT FROM NEW.clinic_id THEN
    RAISE EXCEPTION 'Patient does not belong to this clinic'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.clinic_id, p.role, p.disabled
    INTO v_provider_clinic, v_provider_role, v_provider_disabled
  FROM public.profiles p
  WHERE p.id = NEW.provider_id;

  IF NOT FOUND OR v_provider_clinic IS DISTINCT FROM NEW.clinic_id
     OR v_provider_role IS DISTINCT FROM 'coach'
     OR v_provider_disabled IS TRUE THEN
    RAISE EXCEPTION 'Appointment provider must be an enabled doctor in this clinic'
      USING ERRCODE = '22023';
  END IF;

  IF v_role = 'coach' AND (
    NEW.provider_id IS DISTINCT FROM v_uid
    OR v_patient_invited_by IS DISTINCT FROM v_uid
  ) THEN
    RAISE EXCEPTION 'A doctor may schedule appointments only for their assigned patients'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Appointment creator must match the authenticated user'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Appointment identity, patient, clinic and creator are immutable'
        USING ERRCODE = '42501';
    END IF;

    IF v_role = 'coach' AND NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
      RAISE EXCEPTION 'Only the clinic admin may reassign an appointment to another doctor'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status IN ('completed', 'cancelled', 'no_show')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A closed appointment cannot be reopened or changed'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Lock both resources in a stable order to avoid concurrent double-booking.
  v_provider_lock := pg_catalog.hashtextextended('appointment-provider:' || NEW.provider_id::text, 0);
  v_patient_lock := pg_catalog.hashtextextended('appointment-patient:' || NEW.patient_id::text, 0);

  IF v_provider_lock <= v_patient_lock THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(v_provider_lock);
    PERFORM pg_catalog.pg_advisory_xact_lock(v_patient_lock);
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(v_patient_lock);
    PERFORM pg_catalog.pg_advisory_xact_lock(v_provider_lock);
  END IF;

  IF NEW.status IN ('scheduled', 'confirmed') THEN
    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id IS DISTINCT FROM NEW.id
        AND a.provider_id = NEW.provider_id
        AND a.status IN ('scheduled', 'confirmed')
        AND a.starts_at < NEW.ends_at
        AND a.ends_at > NEW.starts_at
    ) THEN
      RAISE EXCEPTION 'هذا الطبيب لديه موعد آخر يتعارض مع التوقيت المحدد'
        USING ERRCODE = '23P01';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id IS DISTINCT FROM NEW.id
        AND a.patient_id = NEW.patient_id
        AND a.status IN ('scheduled', 'confirmed')
        AND a.starts_at < NEW.ends_at
        AND a.ends_at > NEW.starts_at
    ) THEN
      RAISE EXCEPTION 'هذا المريض لديه موعد آخر يتعارض مع التوقيت المحدد'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.validate_appointment_booking()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_validate_booking ON public.appointments;
CREATE TRIGGER appointments_validate_booking
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_appointment_booking();

COMMENT ON TABLE public.appointments IS
  'Clinic-scoped scheduling only. Clinical notes and sensitive encounter details belong in a separately secured clinical-record module.';
COMMENT ON COLUMN public.appointments.status IS
  'scheduled, confirmed, completed, cancelled or no_show; cancelled/completed/no_show are terminal states.';
COMMENT ON COLUMN public.appointments.channel IS
  'in_person, video or phone. External calendar sync and notification delivery are separate integrations.';

COMMIT;
