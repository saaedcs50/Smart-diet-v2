-- Smart Diet v2 — bootstrap the first Production platform owner
-- Run once in the Supabase Production SQL Editor as postgres.
--
-- PRECONDITION:
-- 1) Create/invite the intended owner in Supabase Auth > Users first.
-- 2) The owner must have accepted/confirmed the email.
-- 3) Replace the email literal below with that exact Auth email.
--
-- SAFETY:
-- - This inserts exactly one owner profile; it never creates an Auth user.
-- - It refuses to run if there is not exactly one matching confirmed Auth user,
--   if that Auth user already has a profile, or if an owner profile already exists.
-- - It does not create a clinic, subscription, invitation, or patient.
-- - Do not run this against Staging or the legacy Smart-diet project.

BEGIN;

DO $bootstrap_first_owner$
DECLARE
  v_owner_email text := lower(btrim('REPLACE_WITH_OWNER_EMAIL'));
  v_owner_uid uuid;
  v_owner_name text;
  v_matching_users integer;
BEGIN
  IF v_owner_email = 'replace_with_owner_email'
     OR position('@' IN v_owner_email) < 2 THEN
    RAISE EXCEPTION 'Replace REPLACE_WITH_OWNER_EMAIL with the exact intended owner email.';
  END IF;

  SELECT count(*)
    INTO v_matching_users
  FROM auth.users
  WHERE lower(email) = v_owner_email;

  IF v_matching_users <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Auth user for %, found %.', v_owner_email, v_matching_users;
  END IF;

  SELECT
    id,
    coalesce(
      nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(raw_user_meta_data ->> 'name'), ''),
      split_part(email, '@', 1)
    )
    INTO v_owner_uid, v_owner_name
  FROM auth.users
  WHERE lower(email) = v_owner_email
    AND email_confirmed_at IS NOT NULL;

  IF v_owner_uid IS NULL THEN
    RAISE EXCEPTION 'The Auth user % must confirm the email before owner bootstrap.', v_owner_email;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'owner') THEN
    RAISE EXCEPTION 'An owner profile already exists; refusing to create another one.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_owner_uid) THEN
    RAISE EXCEPTION 'The selected Auth user already has a profile; refusing to overwrite it.';
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    clinic_id,
    email,
    display_name,
    disabled
  )
  VALUES (
    v_owner_uid,
    'owner',
    'platform',
    v_owner_email,
    v_owner_name,
    false
  );

  RAISE NOTICE 'Created the first platform owner profile for % (uid=%).', v_owner_email, v_owner_uid;
END
$bootstrap_first_owner$;

COMMIT;
