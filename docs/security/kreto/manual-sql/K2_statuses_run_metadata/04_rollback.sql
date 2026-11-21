-- LOT K2 -- 04 ROLLBACK. Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It puts lot E's guard back exactly as lot E wrote it and drops orch_runs.profile and orch_runs.effort with their checks. It leaves model and
-- tool_names (they belong to migration 20260915100000) and the three enum labels: PostgreSQL cannot remove an enum label.
-- It stops if any row already uses a K2 label: lot E's guard would trap such an action ('unknown' could never be resolved). Decide what
-- those rows should say first; the stop message counts them. 'cancelled' is final under the guard, so rewriting such a row means disabling
-- trg_guard_orch_action_transitions for that one statement and enabling it again in the same transaction.
--
-- DOES THIS REINTRODUCE A WEAKNESS? No security weakness: the guard goes back to lot E's paths. What returns is the untruth K2 removed:
-- "not confirmed" can again only be stored as "failed".

BEGIN;

DO $assert$
DECLARE
  v_actions bigint; v_runs bigint;
BEGIN
  SELECT count(*) INTO v_actions FROM public.orch_actions WHERE status::text IN ('unknown', 'cancelled');
  SELECT count(*) INTO v_runs FROM public.orch_runs WHERE status::text = 'partial';
  IF v_actions > 0 OR v_runs > 0 THEN
    RAISE EXCEPTION 'ROLLBACK STOPPED: % actions use unknown/cancelled and % runs use partial. Nothing was changed.', v_actions, v_runs;
  END IF;
END
$assert$;

CREATE OR REPLACE FUNCTION public.guard_orch_action_transitions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.status <> 'proposed' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.tool_name IS DISTINCT FROM OLD.tool_name
       OR NEW.tool_args IS DISTINCT FROM OLD.tool_args
       OR NEW.run_id IS DISTINCT FROM OLD.run_id
       OR NEW.risk_level IS DISTINCT FROM OLD.risk_level THEN
      RAISE EXCEPTION 'a decided agent action cannot change its owner, tool, arguments, run or risk level' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'proposed' AND NEW.status IN ('approved', 'rejected', 'auto_executed', 'executed', 'failed'))
    OR (OLD.status = 'approved' AND NEW.status IN ('executed', 'failed', 'proposed'))
    OR (OLD.status = 'executed' AND NEW.status IN ('approved', 'failed'))
  ) THEN
    RAISE EXCEPTION 'agent action status cannot go from % to %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$fn$;

ALTER TABLE public.orch_runs DROP CONSTRAINT IF EXISTS orch_runs_profile_shape, DROP CONSTRAINT IF EXISTS orch_runs_effort_range;
ALTER TABLE public.orch_runs DROP COLUMN IF EXISTS profile, DROP COLUMN IF EXISTS effort;

COMMIT;

SELECT 'rolled back' AS result, 'the enum labels unknown, cancelled and partial remain, unused' AS note;
