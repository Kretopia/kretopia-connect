-- LOT K2 -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql. Every row should say PASS.
--
-- What it proves: the labels and columns exist, the guard is the K2 version and still the one the trigger calls, and the guard's decisions
-- are exactly the intended table (it is called on synthetic OLD/NEW pairs inside a rolled-back block, so no row is touched).
-- What it does not prove: that the code writes the new values. Nothing does until the code change that uses them is deployed.

DO $paths$
DECLARE
  v_allowed text[] := ARRAY[
    'proposed>approved', 'proposed>rejected', 'proposed>auto_executed', 'proposed>executed', 'proposed>failed', 'proposed>unknown', 'proposed>cancelled',
    'approved>executed', 'approved>failed', 'approved>proposed', 'approved>unknown',
    'executed>approved', 'executed>failed',
    'unknown>executed', 'unknown>failed'];
  v_statuses text[] := ARRAY['proposed', 'approved', 'rejected', 'executed', 'failed', 'auto_executed', 'unknown', 'cancelled'];
  v_from text; v_to text; v_ok boolean; v_bad text := '';
  v_run uuid; v_id uuid;
BEGIN
  -- A throwaway run and action, undone at the end of this block by the exception below.
  INSERT INTO public.orch_runs (user_id) VALUES ('00000000-0000-0000-0000-00000000c0de') RETURNING id INTO v_run;
  FOREACH v_from IN ARRAY v_statuses LOOP
    FOREACH v_to IN ARRAY v_statuses LOOP
      CONTINUE WHEN v_from = v_to;
      INSERT INTO public.orch_actions (run_id, user_id, tool_name, status) VALUES (v_run, '00000000-0000-0000-0000-00000000c0de', 'k2_verify', v_from::public.orch_action_status)
      RETURNING id INTO v_id;
      BEGIN
        UPDATE public.orch_actions SET status = v_to::public.orch_action_status WHERE id = v_id;
        v_ok := true;
      EXCEPTION WHEN check_violation THEN
        v_ok := false;
      END;
      IF v_ok <> ((v_from || '>' || v_to) = ANY (v_allowed)) THEN
        v_bad := v_bad || format(' %s>%s(%s)', v_from, v_to, CASE WHEN v_ok THEN 'allowed' ELSE 'refused' END);
      END IF;
    END LOOP;
  END LOOP;
  RAISE EXCEPTION 'K2_PATHS:%', CASE WHEN v_bad = '' THEN 'OK' ELSE v_bad END;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'K2_PATHS:OK' THEN
    RAISE NOTICE 'PASS guard allows exactly the intended 15 status paths (56 pairs checked, nothing kept)';
  ELSE
    RAISE NOTICE 'FAIL guard paths differ from the intended table:%', substr(SQLERRM, 10);
  END IF;
END
$paths$;

WITH checks(name, ok) AS (
  SELECT 'action statuses include unknown and cancelled', EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.orch_action_status'::regtype AND enumlabel = 'unknown')
                                                    AND EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.orch_action_status'::regtype AND enumlabel = 'cancelled')
  UNION ALL SELECT 'run statuses include partial', EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.orch_run_status'::regtype AND enumlabel = 'partial')
  UNION ALL SELECT 'guard is the K2 version', (SELECT prosrc LIKE '%K2: a person checked what happened%' FROM pg_proc WHERE oid = 'public.guard_orch_action_transitions()'::regprocedure)
  UNION ALL SELECT 'the trigger still calls the guard', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_orch_action_transitions' AND tgrelid = 'public.orch_actions'::regclass AND NOT tgenabled = 'D')
  UNION ALL SELECT 'orch_runs has model, tool_names, profile, effort', (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_runs' AND column_name IN ('model', 'tool_names', 'profile', 'effort')) = 4
  UNION ALL SELECT 'profile and effort are checked', (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.orch_runs'::regclass AND conname IN ('orch_runs_profile_shape', 'orch_runs_effort_range')) = 2
)
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM checks ORDER BY ok, name;
