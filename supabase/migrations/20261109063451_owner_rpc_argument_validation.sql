-- Tighten null argument handling for owner RPCs without redefining their
-- entire bodies. The functions are already installed by 20261109063122.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.owner_review_clinic_payment(text,text,text,integer,text)'::regprocedure
  ) INTO v_definition;

  IF position('IF p_action IS NULL OR p_action NOT IN' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      'IF p_action NOT IN (''activate'', ''reject'') THEN',
      'IF p_action IS NULL OR p_action NOT IN (''activate'', ''reject'') THEN'
    );
  END IF;

  IF position('p_plan IS NULL OR p_plan NOT IN' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      'IF p_action = ''activate'' AND p_plan NOT IN (''permanent'', ''monthly'', ''annual'') THEN',
      'IF p_action = ''activate'' AND (p_plan IS NULL OR p_plan NOT IN (''permanent'', ''monthly'', ''annual'')) THEN'
    );
  END IF;

  IF position('length(btrim(coalesce(p_note, ''''))) > 500' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      'IF p_action = ''reject''',
      'IF p_action = ''reject'' AND length(btrim(coalesce(p_note, ''''))) > 500 THEN
    RAISE EXCEPTION ''Rejection note is too long'' USING ERRCODE = ''22023'';
  END IF;

  IF p_action = ''reject'''
    );
  END IF;

  IF position('p_action IS NULL OR p_action NOT IN' IN v_definition) = 0
     OR position('p_plan IS NULL OR p_plan NOT IN' IN v_definition) = 0
     OR position('Rejection note is too long' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely apply owner RPC validation changes';
  END IF;

  EXECUTE v_definition;
END;
$migration$;