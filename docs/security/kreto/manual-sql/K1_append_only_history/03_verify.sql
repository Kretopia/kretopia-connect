-- LOT K1 -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql. Every row should say PASS.
--
-- What it proves: the catalog no longer gives members (anon, authenticated) a write policy or privilege on these four tables, members keep
-- their read policies, and the service role keeps its privileges.
-- What it does not prove: the SQL Editor runs as postgres and bypasses RLS. The proof for a real member is a REST call with their token,
-- which must now fail with 401/403 (code 42501):
--   curl -X POST "https://<project>.supabase.co/rest/v1/orch_runs" -H "apikey: <anon key>" -H "Authorization: Bearer <member JWT>" \
--        -H "Content-Type: application/json" -d '{"user_id":"<that member id>"}'

WITH checks(name, ok) AS (
  SELECT 'no member write policy on orch_runs', NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_runs' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
  UNION ALL SELECT 'no member write policy on orch_approvals', NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
  UNION ALL SELECT 'no member update or delete policy on copilot_plans', NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'copilot_plans' AND cmd IN ('UPDATE', 'DELETE', 'ALL'))
  UNION ALL SELECT 'no member delete policy on agent_project_context', NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_project_context' AND cmd IN ('DELETE', 'ALL'))
  UNION ALL SELECT 'authenticated cannot insert, update or delete orch_runs', NOT (has_table_privilege('authenticated', 'public.orch_runs', 'INSERT') OR has_table_privilege('authenticated', 'public.orch_runs', 'UPDATE') OR has_table_privilege('authenticated', 'public.orch_runs', 'DELETE'))
  UNION ALL SELECT 'authenticated cannot insert, update or delete orch_approvals', NOT (has_table_privilege('authenticated', 'public.orch_approvals', 'INSERT') OR has_table_privilege('authenticated', 'public.orch_approvals', 'UPDATE') OR has_table_privilege('authenticated', 'public.orch_approvals', 'DELETE'))
  UNION ALL SELECT 'authenticated cannot update or delete copilot_plans', NOT (has_table_privilege('authenticated', 'public.copilot_plans', 'UPDATE') OR has_table_privilege('authenticated', 'public.copilot_plans', 'DELETE'))
  UNION ALL SELECT 'authenticated cannot delete agent_project_context', NOT has_table_privilege('authenticated', 'public.agent_project_context', 'DELETE')
  UNION ALL SELECT 'anon holds none of the revoked privileges', NOT (has_table_privilege('anon', 'public.orch_runs', 'INSERT') OR has_table_privilege('anon', 'public.orch_approvals', 'INSERT') OR has_table_privilege('anon', 'public.copilot_plans', 'UPDATE') OR has_table_privilege('anon', 'public.copilot_plans', 'DELETE') OR has_table_privilege('anon', 'public.agent_project_context', 'DELETE'))
  UNION ALL SELECT 'members still read their own runs, approvals, plans and context', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('orch_runs', 'orch_approvals', 'copilot_plans', 'agent_project_context') AND cmd = 'SELECT') >= 4
  UNION ALL SELECT 'service_role still writes all four tables', has_table_privilege('service_role', 'public.orch_runs', 'INSERT') AND has_table_privilege('service_role', 'public.orch_approvals', 'INSERT') AND has_table_privilege('service_role', 'public.copilot_plans', 'UPDATE') AND has_table_privilege('service_role', 'public.agent_project_context', 'DELETE')
  UNION ALL SELECT 'backup of what was removed is kept, members cannot read it',
    CASE WHEN to_regclass('public.kreto_migration_backup') IS NULL THEN false
         ELSE query_to_xml('SELECT 1 FROM public.kreto_migration_backup WHERE lot = ''K1'' AND kind = ''applied''', false, false, '')::text LIKE '%<row>%'
              AND NOT has_table_privilege('authenticated', 'public.kreto_migration_backup', 'SELECT') END
)
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM checks ORDER BY ok, name;
