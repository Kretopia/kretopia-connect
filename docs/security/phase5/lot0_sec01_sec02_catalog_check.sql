-- Lot 0 -- SEC-01 / SEC-02: read-only catalog check. ONE statement, ONE result. It changes nothing.
--
-- Where to run it: the SQL Editor of the Lovable project "kretopia-app" (the one that reaches production).
-- What it reads: pg_catalog only (pg_proc, pg_policies, pg_class, pg_trigger). No table data.
-- What it proves: how the objects are DEFINED. It does not prove how they BEHAVE for a signed-in caller:
-- the SQL Editor runs as postgres and bypasses RLS, so auth.uid() is NULL here. See lot0_sec01_sec02_verification.md.
--
-- Result: one row per fact, columns (section, object, detail). A missing object is shown as an explicit "*_missing"
-- row, never as an absent row.
--   function            exec_anon / exec_authenticated / exec_service_role, security_definer, proconfig (pinned search_path), owner
--   function_definition the full body (read the RAISE: its ERRCODE decides the HTTP code of REST call 2)
--   table               rls_enabled / rls_forced for public.projects (policies mean nothing while RLS is off)
--   policy              every INSERT and ALL policy on public.projects: cmd, permissive, roles, using, with_check
--                       (permissive policies are OR-ed: ONE leftover WITH CHECK (true) defeats the strengthened one)
--   trigger             every non-internal trigger on public.projects: enabled flag (O = enabled, D = disabled,
--                       R = replica only, A = always) and its definition (BEFORE/AFTER, INSERT/UPDATE OF ...)

WITH fn AS (
  SELECT p.oid, p.oid::regprocedure::text AS signature, p.prosecdef, p.proconfig, p.proowner::regrole::text AS owner
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_set_profile_coords'
),
tbl AS (
  SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'projects' AND c.relkind = 'r'
)
SELECT 'function' AS section, fn.signature AS object,
       jsonb_build_object(
         'exec_anon',          has_function_privilege('anon', fn.oid, 'EXECUTE'),
         'exec_authenticated', has_function_privilege('authenticated', fn.oid, 'EXECUTE'),
         'exec_service_role',  has_function_privilege('service_role', fn.oid, 'EXECUTE'),
         'security_definer',   fn.prosecdef,
         'proconfig',          to_jsonb(fn.proconfig),
         'owner',              fn.owner
       ) AS detail
FROM fn
UNION ALL
SELECT 'function_missing', 'public.admin_set_profile_coords', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM fn)
UNION ALL
SELECT 'function_definition', fn.signature, jsonb_build_object('definition', pg_get_functiondef(fn.oid))
FROM fn
UNION ALL
SELECT 'table', 'public.projects', jsonb_build_object('rls_enabled', tbl.relrowsecurity, 'rls_forced', tbl.relforcerowsecurity)
FROM tbl
UNION ALL
SELECT 'table_missing', 'public.projects', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tbl)
UNION ALL
SELECT 'policy', pol.policyname,
       jsonb_build_object(
         'cmd',        pol.cmd,
         'permissive', pol.permissive,
         'roles',      to_jsonb(pol.roles),
         'using',      pol.qual,
         'with_check', pol.with_check
       )
FROM pg_policies pol
WHERE pol.schemaname = 'public' AND pol.tablename = 'projects' AND pol.cmd IN ('INSERT', 'ALL')
UNION ALL
SELECT 'policy_missing', 'public.projects INSERT/ALL', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM pg_policies pol
  WHERE pol.schemaname = 'public' AND pol.tablename = 'projects' AND pol.cmd IN ('INSERT', 'ALL')
)
UNION ALL
SELECT 'trigger', t.tgname, jsonb_build_object('enabled', t.tgenabled::text, 'definition', pg_get_triggerdef(t.oid))
FROM pg_trigger t
JOIN tbl ON tbl.oid = t.tgrelid
WHERE NOT t.tgisinternal
UNION ALL
SELECT 'trigger_missing', 'public.projects', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN tbl ON tbl.oid = t.tgrelid WHERE NOT t.tgisinternal)
ORDER BY 1, 2;
