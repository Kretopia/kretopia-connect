-- LOT E -- agent approvals are durable and single-use -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after 01_preflight.sql.
-- One transaction. Adds one trigger function with its trigger, one unique partial index and replaces one insert policy. Deletes and
-- rewrites no row.
--
-- Compatibility with the code deployed today (checked against every writer of orch_actions in the repository): the orchestrator, the shared
-- authorizeHighStakesAction, agent-send-dm and send-outreach-draft only make the transitions the guard allows; the stale-run reconcile
-- function rejects proposed actions and fails approved ones, both allowed. A writer I could not see (a function pasted into production by
-- hand, a script) that makes another transition will now get "agent action status cannot go from X to Y" (SQLSTATE 23514): the message
-- names the transition, and 04_rollback.sql removes the guard.
-- Order: SQL first, then nothing to deploy. The edge code of lot 2 works with or without this lot.

BEGIN;

DO $assert$
BEGIN
  IF to_regclass('public.orch_actions') IS NULL OR to_regclass('public.orch_approvals') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: orch_actions or orch_approvals is missing. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'guard_orch_action_transitions')
     OR to_regclass('public.orch_approvals_one_positive_per_action') IS NOT NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: an object of this lot already exists. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orch_approvals WHERE decision IN ('approved', 'edited') GROUP BY action_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'APPLY STOPPED: an action has more than one positive approval. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND cmd IN ('INSERT', 'ALL') AND policyname <> 'Users insert own orch approvals')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND cmd = 'INSERT' AND policyname = 'Users insert own orch approvals') THEN
    RAISE EXCEPTION 'APPLY STOPPED: the insert policies on orch_approvals are not the ones this lot was written for. Nothing was changed.';
  END IF;
END
$assert$;

-- E1. A decided action cannot change what it is; its status only moves along the paths the code uses.
CREATE FUNCTION public.guard_orch_action_transitions()
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

CREATE TRIGGER trg_guard_orch_action_transitions
  BEFORE UPDATE OF status, user_id, tool_name, tool_args, run_id, risk_level ON public.orch_actions
  FOR EACH ROW EXECUTE FUNCTION public.guard_orch_action_transitions();

-- E3. At most one positive approval per action.
CREATE UNIQUE INDEX orch_approvals_one_positive_per_action
  ON public.orch_approvals (action_id) WHERE decision IN ('approved', 'edited');

-- E2. A member records an approval only for their own action.
DROP POLICY "Users insert own orch approvals" ON public.orch_approvals;
CREATE POLICY "Users insert own approvals for own actions" ON public.orch_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orch_actions a WHERE a.id = action_id AND a.user_id = auth.uid())
  );

COMMIT;

SELECT 'applied' AS result, 'now run 03_verify.sql, then 05_CONCURRENCY_TEST.md on an isolated database' AS next_step;
