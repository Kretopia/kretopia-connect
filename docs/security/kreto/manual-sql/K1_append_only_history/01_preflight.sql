-- LOT K1 -- Kreto's agent history is append-only for members -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- What 02_apply.sql takes away from members (anon, authenticated), and nothing else:
--   * inserting rows into orch_runs        (a run is opened by the server; today a member can write a run of their own that never happened)
--   * inserting rows into orch_approvals   (approvals are recorded by agent-orchestrator; lot E narrowed this to the member's own actions,
--                                           this lot closes it)
--   * updating or deleting copilot_plans   (plans are written by copilot-planner and copilot-executor)
--   * deleting rows of agent_project_context (written by desk-agent)
-- plus, on orch_runs and orch_approvals, the table-level UPDATE and DELETE that no policy uses today (so a future permissive policy cannot
-- quietly reopen them). Members keep reading their own rows. Every writer in the repository uses the service role, which these policies
-- and grants do not affect, and the app only reads these tables.
--
-- A writer the repository cannot see (a function pasted into production by hand) that writes these tables with a member's token would start
-- getting "permission denied": the last rows below list the functions whose source writes these tables, with how each one runs.
--
-- It stops with an error if a table is missing (wrong database) or if a member write policy exists that this lot was not written for (so no
-- unknown policy is ever dropped), then returns its findings.

DO $pre$
DECLARE
  v_unknown text;
BEGIN
  IF to_regclass('public.orch_runs') IS NULL OR to_regclass('public.orch_approvals') IS NULL
     OR to_regclass('public.copilot_plans') IS NULL OR to_regclass('public.agent_project_context') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: orch_runs, orch_approvals, copilot_plans or agent_project_context is missing. Is this kretopia-app?';
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
    RAISE EXCEPTION 'PREFLIGHT STOPPED: write policies this lot was not written for: %. Nothing was read further.', v_unknown;
  END IF;
END
$pre$;

SELECT 'policy' AS finding, tablename || '.' || policyname AS name, cmd AS detail, coalesce(qual, with_check) AS expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('orch_runs', 'orch_approvals', 'copilot_plans', 'agent_project_context')
UNION ALL
SELECT 'member_privilege', g.table_name || ' ' || g.privilege_type, g.grantee, 'apply revokes this when it is listed in its REVOKE lines'
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public' AND g.table_name IN ('orch_runs', 'orch_approvals', 'copilot_plans', 'agent_project_context')
  AND g.grantee IN ('PUBLIC', 'anon', 'authenticated') AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
UNION ALL
SELECT 'rows', 'orch_runs', count(*)::text, NULL FROM public.orch_runs
UNION ALL
SELECT 'rows', 'orch_approvals', count(*)::text, NULL FROM public.orch_approvals
UNION ALL
SELECT 'rows', 'copilot_plans', count(*)::text, NULL FROM public.copilot_plans
UNION ALL
SELECT 'rows', 'agent_project_context', count(*)::text, NULL FROM public.agent_project_context
UNION ALL
SELECT 'function_writing_these_tables', p.oid::regprocedure::text,
       CASE WHEN p.prosecdef THEN 'security definer (unaffected)' ELSE 'runs as the caller: affected if a member calls it' END, NULL
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind = 'f'
  AND p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?(orch_runs|orch_approvals|copilot_plans|agent_project_context)\M'
ORDER BY 1, 2;
