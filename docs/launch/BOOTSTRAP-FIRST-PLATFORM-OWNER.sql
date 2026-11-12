-- Smart Diet v2 — bootstrap the first Production platform owner
-- Run once in the Supabase Production SQL Editor as postgres.
--
-- PRECONDITIONS:
-- 1) Use only on the approved Production project (never Staging or legacy Smart-diet).
-- 2) Create/invite the intended owner in Supabase Auth > Users first.
-- 3) The owner must have accepted/confirmed the email.
-- 4) Replace the email literal below with that exact Auth email.
-- 5) Confirm that no owner profile already exists. This script deliberately refuses
--    to run when one exists; it does not repair, replace, or modify existing accounts.
--
-- SAFETY:
-- - This inserts exactly one owner profile; it never creates an Auth user.
-- - It refuses to run if there is not exactly one matching Auth user, if the user's
--   email is unconfirmed, if that user already has a profile, or if an owner exists.
-- - The table lock serializes concurrent executions of this bootstrap script.
-- - It does not create a clinic, subscription, invitation, or patient.
-- - This is a one-time bootstrap for a fresh/uninitialized Production owner only.

BEGIN;

-- Prevent two simultaneous bootstrap runs from both passing the "no owner" check.
LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

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
