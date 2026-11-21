-- LOT K1 -- 04 ROLLBACK. Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It recreates, from public.kreto_migration_backup, exactly the policies and member privileges 02_apply.sql removed (names, commands, roles
-- and expressions as they were in production, not as the repository guessed), then deletes lot K1's backup rows, and the backup table when
-- no other lot uses it.
--
-- DOES THIS REINTRODUCE A WEAKNESS? YES: members can again insert runs and approvals of their own that the server never made, rewrite or
-- delete their plans, and delete their project context. The edge code does not depend on this lot.

BEGIN;

DO $rollback$
DECLARE
  r record;
  v_roles text;
BEGIN
  IF to_regclass('public.kreto_migration_backup') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.kreto_migration_backup WHERE lot = 'K1' AND kind = 'applied') THEN
    RAISE EXCEPTION 'ROLLBACK STOPPED: lot K1 is not applied (no backup rows). Nothing was changed.';
  END IF;

  FOR r IN SELECT detail FROM public.kreto_migration_backup WHERE lot = 'K1' AND kind = 'policy' ORDER BY id LOOP
    SELECT string_agg(CASE WHEN x = 'public' THEN 'PUBLIC' ELSE quote_ident(x) END, ', ') INTO v_roles
    FROM jsonb_array_elements_text(r.detail -> 'roles') AS x;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.detail ->> 'name', r.detail ->> 'table');
    EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
                   r.detail ->> 'name', r.detail ->> 'table', r.detail ->> 'permissive', r.detail ->> 'cmd', coalesce(v_roles, 'PUBLIC'),
                   CASE WHEN r.detail ->> 'using' IS NOT NULL THEN ' USING (' || (r.detail ->> 'using') || ')' ELSE '' END,
                   CASE WHEN r.detail ->> 'with_check' IS NOT NULL THEN ' WITH CHECK (' || (r.detail ->> 'with_check') || ')' ELSE '' END);
  END LOOP;

  FOR r IN SELECT detail FROM public.kreto_migration_backup WHERE lot = 'K1' AND kind = 'grant' ORDER BY id LOOP
    EXECUTE format('GRANT %s ON TABLE public.%I TO %s', r.detail ->> 'privilege', r.detail ->> 'table',
                   CASE WHEN r.detail ->> 'grantee' = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.detail ->> 'grantee') END);
  END LOOP;

  DELETE FROM public.kreto_migration_backup WHERE lot = 'K1';
  IF NOT EXISTS (SELECT 1 FROM public.kreto_migration_backup) THEN
    DROP TABLE public.kreto_migration_backup;
  END IF;
END
$rollback$;

COMMIT;

SELECT 'rolled back' AS result,
       (SELECT string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', ' ORDER BY tablename, policyname) FROM pg_policies
         WHERE schemaname = 'public' AND tablename IN ('orch_runs', 'orch_approvals', 'copilot_plans', 'agent_project_context')
           AND cmd <> 'SELECT') AS member_write_policies_now;
