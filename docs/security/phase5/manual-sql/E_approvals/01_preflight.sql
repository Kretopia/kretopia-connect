-- LOT E -- agent approvals are durable and single-use -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- What the code already does (lot 2, SEC-26/27): an approved action is consumed by a compare-and-set on orch_actions (status approved ->
-- executed, one row wins), after the handler re-reads the action and its approval record, checks owner, tool, target, freshness.
-- NO new table is needed for that: the approvals live in orch_actions / orch_approvals, and a parallel table would only be a second place
-- for them to disagree. What the DATABASE can add, and this lot adds, so that the guarantees hold even if the code is wrong:
--   E1. a decided action cannot change what it is (owner, tool, arguments, run, risk level) and its status only moves along the paths the
--       code uses: proposed -> approved|rejected|auto_executed|executed|failed; approved -> executed|failed|proposed; executed -> approved
--       (the release when a mutation did not happen)|failed. Nothing leaves rejected, failed or auto_executed.
--   E2. a member can record an approval only for their OWN action (today any member can write an approval row for any action id).
--   E3. an action has at most one positive approval (approved or edited).
--
-- It stops with an error if the data already breaks E3, if the objects it needs are missing, if a name is taken, or if the insert policy on
-- orch_approvals is not the one this lot replaces (so that no unknown policy is dropped). It then returns its findings.

DO $pre$
DECLARE
  v_n bigint;
  v_other text;
BEGIN
  IF to_regclass('public.orch_actions') IS NULL OR to_regclass('public.orch_approvals') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: orch_actions or orch_approvals is missing. Nothing was changed.';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.orch_approvals'::regclass) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: RLS is off on orch_approvals. Nothing was changed.';
  END IF;

  -- Names
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'guard_orch_action_transitions')
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.orch_actions'::regclass AND tgname = 'trg_guard_orch_action_transitions' AND NOT tgisinternal)
     OR to_regclass('public.orch_approvals_one_positive_per_action') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND policyname = 'Users insert own approvals for own actions') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: an object of this lot already exists. Nothing was changed.';
  END IF;

  -- The enum labels the guard names must all exist.
  IF (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'orch_action_status' AND e.enumlabel IN ('proposed', 'approved', 'rejected', 'executed', 'failed', 'auto_executed')) <> 6 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: orch_action_status does not have the six labels the guard names. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'orch_approval_decision' AND e.enumlabel IN ('approved', 'rejected', 'edited')) <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: orch_approval_decision does not have approved, rejected and edited. Nothing was changed.';
  END IF;

  -- E3 on the data
  SELECT count(*) INTO v_n FROM (SELECT action_id FROM public.orch_approvals WHERE decision IN ('approved', 'edited') GROUP BY action_id HAVING count(*) > 1) d;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % action(s) already have more than one positive approval. Read them (query below) before going on. Nothing was changed.', v_n;
  END IF;

  -- E2: the policy this lot replaces must be the only way in, and be the one the repository describes.
  SELECT string_agg(policyname, ', ') INTO v_other FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND cmd IN ('INSERT', 'ALL') AND policyname <> 'Users insert own orch approvals';
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: other policy(ies) can insert into orch_approvals: %. Decide before replacing the known one. Nothing was changed.', v_other;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND policyname = 'Users insert own orch approvals' AND cmd = 'INSERT') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the policy "Users insert own orch approvals" is not on orch_approvals. The state is not the one this lot was written for. Nothing was changed.';
  END IF;
END
$pre$;

-- Findings, for you to read
SELECT 'policies_on_orch_approvals' AS finding, policyname AS name, cmd, with_check AS detail FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals'
UNION ALL
SELECT 'triggers_on_orch_actions', tgname::text, 'trigger', pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.orch_actions'::regclass AND NOT tgisinternal
UNION ALL
SELECT 'action_status_counts', status::text, count(*)::text, NULL FROM public.orch_actions GROUP BY status
UNION ALL
SELECT 'approvals_for_a_missing_or_foreign_action', 'rows', count(*)::text, 'approvals whose user is not the action owner (what E2 stops from now on)'
FROM public.orch_approvals ap JOIN public.orch_actions a ON a.id = ap.action_id WHERE ap.user_id <> a.user_id
ORDER BY 1, 2;
