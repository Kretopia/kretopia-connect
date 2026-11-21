-- LOT K1 -- Kreto's agent history is append-only for members -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after
-- 01_preflight.sql returned its findings. One transaction. It drops up to six member write policies, revokes the matching member privileges,
-- and keeps an exact copy of both in public.kreto_migration_backup so that 04_rollback.sql puts back what was there, not what the repository
-- guessed. It changes and deletes no row of the four tables.
--
-- Compatibility (checked against every writer of these tables in the repository): agent-orchestrator, desk-agent, desk-daily-nudge,
-- _shared/agentAuthority, copilot-planner and copilot-executor write them with the service role; the app only reads them
-- (CopilotPlanCard reads copilot_plans). Account deletion and ON DELETE CASCADE are unaffected: they do not go through member policies.
-- Order: SQL only, nothing to deploy.

BEGIN;

DO $assert$
DECLARE
  v_unknown text;
BEGIN
  IF to_regclass('public.orch_runs') IS NULL OR to_regclass('public.orch_approvals') IS NULL
     OR to_regclass('public.copilot_plans') IS NULL OR to_regclass('public.agent_project_context') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: orch_runs, orch_approvals, copilot_plans or agent_project_context is missing. Nothing was changed.';
  END IF;
  SELECT string_agg(format('%s.%s (%s)', tablename, policyname, cmd), ', ') INTO v_unknown
  FROM pg_policies
  WHERE schemaname = 'public' AND (
       (tablename = 'orch_runs' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND policyname <> 'Users insert own orch runs')
    OR (tablename = 'orch_approvals' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND policyname NOT IN ('Users insert own orch approvals', 'Users insert own approvals for own actions'))
    OR (tablename = 'copilot_plans' AND cmd IN ('UPDATE', 'DELETE', 'ALL') AND policyname NOT IN ('Users update own plans', 'Users delete own plans'))
    OR (tablename = 'agent_project_context' AND cmd IN ('DELETE', 'ALL') AND policyname <> 'Users delete own agent context'));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: write policies this lot was not written for: %. Nothing was changed.', v_unknown;
  END IF;
  -- Nested on purpose: PL/pgSQL prepares a whole condition, so the backup table is only named once it is known to exist.
  IF to_regclass('public.kreto_migration_backup') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.kreto_migration_backup WHERE lot = 'K1') THEN
      RAISE EXCEPTION 'APPLY STOPPED: lot K1 is already applied (its backup rows exist). Nothing was changed.';
    END IF;
  END IF;
END
$assert$;

-- Shared by the Kreto lots: what an apply removed or changed, so its rollback restores exactly that. Nobody but the database owner and the
-- service role can read it.
CREATE TABLE IF NOT EXISTS public.kreto_migration_backup (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot text NOT NULL,
  kind text NOT NULL,
  object text NOT NULL,
  detail jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kreto_migration_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kreto_migration_backup FROM PUBLIC, anon, authenticated;

INSERT INTO public.kreto_migration_backup (lot, kind, object, detail)
SELECT 'K1', 'policy', tablename || '.' || policyname,
       jsonb_build_object('table', tablename, 'name', policyname, 'permissive', permissive, 'cmd', cmd, 'roles', to_jsonb(roles),
                          'using', qual, 'with_check', with_check)
FROM pg_policies
WHERE schemaname = 'public' AND (
     (tablename = 'orch_runs' AND policyname = 'Users insert own orch runs')
  OR (tablename = 'orch_approvals' AND policyname IN ('Users insert own orch approvals', 'Users insert own approvals for own actions'))
  OR (tablename = 'copilot_plans' AND policyname IN ('Users update own plans', 'Users delete own plans'))
  OR (tablename = 'agent_project_context' AND policyname = 'Users delete own agent context'));

INSERT INTO public.kreto_migration_backup (lot, kind, object, detail)
SELECT 'K1', 'grant', g.table_name || ' ' || g.privilege_type || ' ' || g.grantee,
       jsonb_build_object('table', g.table_name, 'privilege', g.privilege_type, 'grantee', g.grantee)
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public' AND g.grantee IN ('PUBLIC', 'anon', 'authenticated')
  AND ((g.table_name IN ('orch_runs', 'orch_approvals') AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    OR (g.table_name = 'copilot_plans' AND g.privilege_type IN ('UPDATE', 'DELETE'))
    OR (g.table_name = 'agent_project_context' AND g.privilege_type = 'DELETE'));

INSERT INTO public.kreto_migration_backup (lot, kind, object, detail) VALUES ('K1', 'applied', 'K1', '{}'::jsonb);

DROP POLICY IF EXISTS "Users insert own orch runs" ON public.orch_runs;
DROP POLICY IF EXISTS "Users insert own orch approvals" ON public.orch_approvals;
DROP POLICY IF EXISTS "Users insert own approvals for own actions" ON public.orch_approvals;
DROP POLICY IF EXISTS "Users update own plans" ON public.copilot_plans;
DROP POLICY IF EXISTS "Users delete own plans" ON public.copilot_plans;
DROP POLICY IF EXISTS "Users delete own agent context" ON public.agent_project_context;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.orch_runs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orch_approvals FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON TABLE public.copilot_plans FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON TABLE public.agent_project_context FROM PUBLIC, anon, authenticated;

-- Inside the transaction: if any member can still write, undo everything.
DO $check$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('orch_runs', 'INSERT'), ('orch_runs', 'UPDATE'), ('orch_runs', 'DELETE'),
                                 ('orch_approvals', 'INSERT'), ('orch_approvals', 'UPDATE'), ('orch_approvals', 'DELETE'),
                                 ('copilot_plans', 'UPDATE'), ('copilot_plans', 'DELETE'), ('agent_project_context', 'DELETE')) v(t, p) LOOP
    IF has_table_privilege('authenticated', 'public.' || r.t, r.p) OR has_table_privilege('anon', 'public.' || r.t, r.p) THEN
      RAISE EXCEPTION 'APPLY UNDONE: a member role still holds % on %. Nothing was changed.', r.p, r.t;
    END IF;
  END LOOP;
END
$check$;

COMMIT;

SELECT 'applied' AS result, (SELECT count(*) FROM public.kreto_migration_backup WHERE lot = 'K1' AND kind = 'policy') AS policies_dropped,
       (SELECT count(*) FROM public.kreto_migration_backup WHERE lot = 'K1' AND kind = 'grant') AS grants_revoked,
       'now run 03_verify.sql' AS next_step;
