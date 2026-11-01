-- LOT E -- agent approvals -- 04 ROLLBACK (targeted). Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It removes the guard trigger and its function, the unique partial index, and puts the original insert policy back
-- ("Users insert own orch approvals": any member may write an approval row for any action id).
--
-- DOES THIS REINTRODUCE A WEAKNESS? YES, three: a decided action can again be rewritten at the database level (owner, tool, arguments),
-- its status can move along any path, and a member can again write approval rows (including a rejection) for other members' actions.
-- The edge code of lot 2 does not depend on this lot, so rolling it back removes a second line of defence, not the first.

BEGIN;

DROP TRIGGER IF EXISTS trg_guard_orch_action_transitions ON public.orch_actions;
DROP FUNCTION IF EXISTS public.guard_orch_action_transitions();
DROP INDEX IF EXISTS public.orch_approvals_one_positive_per_action;

DROP POLICY IF EXISTS "Users insert own approvals for own actions" ON public.orch_approvals;
CREATE POLICY "Users insert own orch approvals" ON public.orch_approvals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;

SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' ORDER BY policyname;
