-- LOT C2 -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after 01_preflight.sql (and after lot C).
-- One transaction. It only REMOVES the right of members (authenticated, anon) to INSERT or UPDATE four columns of public.profiles. It grants
-- nothing and deletes nothing; the service role and the SECURITY DEFINER sign-up functions keep writing them.
-- Order: SQL first, then nothing to deploy (no browser code writes these columns). Business risk: a function that runs AS THE CALLER and
-- UPDATEs one of them would start to answer "permission denied"; 01_preflight lists such functions in functions_that_write_them.

BEGIN;

DO $assert$
DECLARE
  v_missing text;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: public.profiles is missing. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) <> 3 THEN
    RAISE EXCEPTION 'APPLY STOPPED: anon, authenticated or service_role is missing. Nothing was changed.';
  END IF;
  SELECT string_agg(c, ', ') INTO v_missing
  FROM unnest(ARRAY['project_credits', 'available_invites', 'invite_code_used', 'invited_by']) AS c
  WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = 'public.profiles'::regclass AND a.attname::text = c AND a.attnum > 0 AND NOT a.attisdropped);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: column(s) missing from public.profiles: %. Nothing was changed.', v_missing;
  END IF;
  IF has_table_privilege('authenticated', 'public.profiles', 'UPDATE') OR has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     OR has_table_privilege('anon', 'public.profiles', 'UPDATE') OR has_table_privilege('anon', 'public.profiles', 'INSERT') THEN
    RAISE EXCEPTION 'APPLY STOPPED: a member role holds a table-level INSERT or UPDATE on public.profiles, so a column REVOKE would do nothing. Apply lot C first. Nothing was changed.';
  END IF;
END
$assert$;

CREATE TEMP TABLE _c2_before ON COMMIT DROP AS
SELECT count(*) FILTER (WHERE has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE')) AS updatable,
       count(*) FILTER (WHERE a.attname::text IN ('project_credits', 'available_invites', 'invite_code_used', 'invited_by') AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE')) AS of_the_four
FROM pg_attribute a
WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped;

REVOKE UPDATE (project_credits, available_invites, invite_code_used, invited_by) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT (project_credits, available_invites, invite_code_used, invited_by) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

DO $post$
DECLARE
  b record;
  v_now integer;
BEGIN
  SELECT * INTO b FROM _c2_before;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['project_credits', 'available_invites', 'invite_code_used', 'invited_by']) AS c
             WHERE has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE') OR has_column_privilege('authenticated', 'public.profiles', c, 'INSERT')
                OR has_column_privilege('anon', 'public.profiles', c, 'UPDATE') OR has_column_privilege('anon', 'public.profiles', c, 'INSERT')) THEN
    RAISE EXCEPTION 'APPLY STOPPED: a member role can still write one of the four columns. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['project_credits', 'available_invites', 'invite_code_used', 'invited_by']) AS c WHERE NOT has_column_privilege('service_role', 'public.profiles', c, 'UPDATE')) THEN
    RAISE EXCEPTION 'APPLY STOPPED: the service role cannot update one of the four columns. Nothing was changed.';
  END IF;
  SELECT count(*) INTO v_now FROM pg_attribute a
  WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE');
  IF v_now <> b.updatable - b.of_the_four THEN
    RAISE EXCEPTION 'APPLY STOPPED: members could update % columns before, % of them among the four, so % were expected afterwards and % were found. Nothing was changed.',
      b.updatable, b.of_the_four, b.updatable - b.of_the_four, v_now;
  END IF;
END
$post$;

COMMIT;

SELECT 'applied' AS result, 'now run 03_verify.sql' AS next_step;
