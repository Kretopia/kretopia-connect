-- LOT A -- durable budgets -- 03b VERIFY AS THE THREE API ROLES. Optional, and worth doing before any function is wired to the budget.
-- Run it in the SQL Editor of "kretopia-app" as ONE script, after 03_verify.sql. It needs no key and no secret.
--
-- WHY: 03_verify.sql reads the privilege tables. This script makes the database itself answer, as anon, as authenticated and as
-- service_role, with SET LOCAL ROLE. It shows (1) that the two roles clients use can neither call the three functions nor touch the
-- two tables, (2) that service_role can read the tables but not write them, (3) that service_role can run reserve then commit.
-- The service_role rows are also the positive control: if the harness could only ever say "denied", they would not say "allowed".
--
-- IT LEAVES NOTHING BEHIND. Every write happens inside a block that ends by raising an error on purpose, which rolls the block back;
-- the role switches are SET LOCAL and end with it. The only things this file creates are three functions in your session's pg_temp
-- schema, which disappear when the session ends. The last-but-one row counts what was left behind: it must be 0.
--
-- WHAT THIS DOES NOT PROVE
--   * Anything under concurrency: that is 05_CONCURRENCY_TEST.md, on an isolated database.
--   * How PostgREST and a real JWT are treated. In this editor session_user is postgres, which the three functions let through on
--     purpose (maintenance), so their own "is the caller the service role?" test is NOT exercised here. The privileges are: a role
--     without EXECUTE never reaches a function body. PostgREST's own answer is only seen with the REST call at the end of
--     03_verify.sql: HTTP 401 with code 42501 = denied; HTTP 404 with PGRST202 = PostgREST does not list the function, which is not
--     a proof about the privilege (run NOTIFY pgrst, 'reload schema' and repeat); HTTP 200 = anon can reserve budget, run 04_rollback.sql.
--
-- READING THE RESULT: every row needs ok = true and the last row (step 1000) says whether they all matched. A "got" that starts with
-- "other:" is not a pass: its detail column says what the database answered instead. ROLE_SWITCH_FAILED or ROLE_NOT_ASSUMED means the
-- editor's user may not become that role (reported on its own, so it can never be read as "denied"). If the editor says a pg_temp function
-- does not exist, it ran the statements in different sessions: run the whole file in one session.

-- One probe: become p_role, run p_sql, come back. It never raises, it reports.
--   state 'ok' = the statement ran; otherwise the SQLSTATE of the error, or ROLE_NOT_ASSUMED / ROLE_SWITCH_FAILED.
CREATE OR REPLACE FUNCTION pg_temp.lot_a_try(p_role text, p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
AS $try$
DECLARE
  v_orig  text := current_user::text;   -- put back exactly, not with RESET ROLE: the editor may itself run under a SET ROLE
  v_state text := 'ok';
  v_msg   text := '';
  v_rows  jsonb := '[]'::jsonb;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  IF current_user::text <> p_role THEN
    v_msg := 'current_user is ' || current_user::text;
    EXECUTE format('SET LOCAL ROLE %I', v_orig);
    RETURN jsonb_build_object('state', 'ROLE_NOT_ASSUMED', 'msg', v_msg, 'rows', v_rows);
  END IF;
  BEGIN
    IF upper(left(ltrim(p_sql), 6)) = 'SELECT' THEN
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) FROM (' || p_sql || ') q' INTO v_rows;
    ELSE
      EXECUTE p_sql;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
    v_msg := SQLERRM;
  END;
  EXECUTE format('SET LOCAL ROLE %I', v_orig);
  RETURN jsonb_build_object('state', v_state, 'msg', v_msg, 'rows', v_rows);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('state', 'ROLE_SWITCH_FAILED', 'msg', SQLERRM, 'rows', '[]'::jsonb);
END
$try$;

-- One expectation. p_expected is 'denied' (SQLSTATE 42501 and a "permission denied for ..." message) or 'allowed' (ran without error).
CREATE OR REPLACE FUNCTION pg_temp.lot_a_check(p_rows jsonb, p_who text, p_what text, p_sql text, p_expected text)
RETURNS jsonb
LANGUAGE plpgsql
AS $chk$
DECLARE
  v_try jsonb := pg_temp.lot_a_try(p_who, p_sql);
  v_got text;
BEGIN
  v_got := CASE
    WHEN v_try->>'state' = 'ok' THEN 'allowed'
    WHEN v_try->>'state' = '42501' AND v_try->>'msg' LIKE 'permission denied for %' THEN 'denied'
    ELSE 'other: ' || (v_try->>'state')
  END;
  RETURN p_rows || jsonb_build_array(jsonb_build_object(
    'who', p_who, 'what', p_what, 'expected', p_expected, 'got', v_got, 'detail', left(v_try->>'msg', 160)));
END
$chk$;

CREATE OR REPLACE FUNCTION pg_temp.lot_a_role_probe()
RETURNS jsonb
LANGUAGE plpgsql
AS $probe$
DECLARE
  v_rows jsonb := '[]'::jsonb;   -- the report; PL/pgSQL variables are not rolled back, so it survives the undo at the end of the block
  v_try  jsonb;
  v_id   uuid;
  v_used integer;
  v_resv integer;
  v_left bigint;
  v_who  text;
BEGIN
  BEGIN
    -- 1) the two roles clients use: no function, no table
    FOREACH v_who IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      v_rows := pg_temp.lot_a_check(v_rows, v_who, 'call reserve_budget',
        $q$SELECT * FROM public.reserve_budget('verify:client', 31536000, 1, 1, 60)$q$, 'denied');
      v_rows := pg_temp.lot_a_check(v_rows, v_who, 'call commit_budget',
        $q$SELECT public.commit_budget(gen_random_uuid())$q$, 'denied');
      v_rows := pg_temp.lot_a_check(v_rows, v_who, 'call release_budget',
        $q$SELECT public.release_budget(gen_random_uuid())$q$, 'denied');
      v_rows := pg_temp.lot_a_check(v_rows, v_who, 'read budget_buckets',
        $q$SELECT * FROM public.budget_buckets LIMIT 1$q$, 'denied');
      v_rows := pg_temp.lot_a_check(v_rows, v_who, 'read budget_reservations',
        $q$SELECT * FROM public.budget_reservations LIMIT 1$q$, 'denied');
      v_rows := pg_temp.lot_a_check(v_rows, v_who, 'insert into budget_buckets',
        $q$INSERT INTO public.budget_buckets (bucket_key, window_start, limit_units) VALUES ('verify:client', now(), 1)$q$, 'denied');
    END LOOP;

    -- 2) service_role: may read the counters, may not write them
    v_rows := pg_temp.lot_a_check(v_rows, 'service_role', 'read budget_buckets',
      $q$SELECT * FROM public.budget_buckets LIMIT 1$q$, 'allowed');
    v_rows := pg_temp.lot_a_check(v_rows, 'service_role', 'read budget_reservations',
      $q$SELECT * FROM public.budget_reservations LIMIT 1$q$, 'allowed');
    v_rows := pg_temp.lot_a_check(v_rows, 'service_role', 'insert into budget_buckets',
      $q$INSERT INTO public.budget_buckets (bucket_key, window_start, limit_units) VALUES ('verify:svc-write', now(), 1)$q$, 'denied');
    v_rows := pg_temp.lot_a_check(v_rows, 'service_role', 'update budget_buckets',
      $q$UPDATE public.budget_buckets SET used_units = 0 WHERE false$q$, 'denied');
    v_rows := pg_temp.lot_a_check(v_rows, 'service_role', 'delete from budget_reservations',
      $q$DELETE FROM public.budget_reservations WHERE false$q$, 'denied');

    -- 3) service_role: the allowed path, end to end. The bucket has a limit of 1 for a year, so the second reserve must be refused.
    v_try := pg_temp.lot_a_try('service_role', $q$SELECT * FROM public.reserve_budget('verify:svc', 31536000, 1, 1, 60)$q$);
    v_id := nullif(v_try->'rows'->0->>'reservation_id', '')::uuid;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'who', 'service_role', 'what', 'reserve_budget, first call', 'expected', 'allowed=true',
      'got', CASE WHEN v_try->>'state' = 'ok' THEN 'allowed=' || coalesce(v_try->'rows'->0->>'allowed', 'null')
                  ELSE 'other: ' || (v_try->>'state') END,
      'detail', left(v_try->>'msg', 160)));

    v_try := pg_temp.lot_a_try('service_role', $q$SELECT * FROM public.reserve_budget('verify:svc', 31536000, 1, 1, 60)$q$);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'who', 'service_role', 'what', 'reserve_budget, second call at the limit', 'expected', 'allowed=false',
      'got', CASE WHEN v_try->>'state' = 'ok' THEN 'allowed=' || coalesce(v_try->'rows'->0->>'allowed', 'null')
                  ELSE 'other: ' || (v_try->>'state') END,
      'detail', left(v_try->>'msg', 160)));

    v_try := pg_temp.lot_a_try('service_role', format('SELECT public.commit_budget(%L::uuid) AS committed', v_id));
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'who', 'service_role', 'what', 'commit_budget, first call', 'expected', 'committed=true',
      'got', CASE WHEN v_try->>'state' = 'ok' THEN 'committed=' || coalesce(v_try->'rows'->0->>'committed', 'null')
                  ELSE 'other: ' || (v_try->>'state') END,
      'detail', left(v_try->>'msg', 160)));

    v_try := pg_temp.lot_a_try('service_role', format('SELECT public.commit_budget(%L::uuid) AS committed', v_id));
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'who', 'service_role', 'what', 'commit_budget, second call (already settled)', 'expected', 'committed=false',
      'got', CASE WHEN v_try->>'state' = 'ok' THEN 'committed=' || coalesce(v_try->'rows'->0->>'committed', 'null')
                  ELSE 'other: ' || (v_try->>'state') END,
      'detail', left(v_try->>'msg', 160)));

    -- 4) what the counters say, read as the editor's own user
    SELECT b.used_units, b.reserved_units INTO v_used, v_resv FROM public.budget_buckets b WHERE b.bucket_key = 'verify:svc';
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'who', 'postgres', 'what', 'counters of the probe bucket after reserve then commit', 'expected', 'used=1 reserved=0',
      'got', 'used=' || coalesce(v_used::text, 'null') || ' reserved=' || coalesce(v_resv::text, 'null'), 'detail', ''));

    RAISE EXCEPTION 'PROBE_DONE';   -- rolls back every row, role switch and reservation made above
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PROBE_DONE' THEN
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'who', 'script', 'what', 'the probe stopped on an unexpected error', 'expected', 'none',
        'got', 'other: ' || SQLSTATE, 'detail', left(SQLERRM, 160)));
    END IF;
  END;

  SELECT (SELECT count(*) FROM public.budget_buckets WHERE bucket_key LIKE 'verify:%')
       + (SELECT count(*) FROM public.budget_reservations WHERE bucket_key LIKE 'verify:%') INTO v_left;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'who', 'postgres', 'what', 'rows left behind by this probe in the two tables', 'expected', '0', 'got', v_left::text, 'detail', ''));
  RETURN v_rows;
END
$probe$;

WITH report AS (
  SELECT r.ord::integer AS step,
         r.elem->>'who' AS who,
         r.elem->>'what' AS what,
         r.elem->>'expected' AS expected,
         r.elem->>'got' AS got,
         (r.elem->>'expected') = (r.elem->>'got') AS ok,
         r.elem->>'detail' AS detail
  FROM jsonb_array_elements(pg_temp.lot_a_role_probe()) WITH ORDINALITY AS r(elem, ord)
)
SELECT step, who, what, expected, got, ok, detail FROM report
UNION ALL
SELECT 1000, 'summary', 'every probe answered as expected', 'true', bool_and(ok)::text, bool_and(ok), count(*)::text || ' probes' FROM report
ORDER BY step;
