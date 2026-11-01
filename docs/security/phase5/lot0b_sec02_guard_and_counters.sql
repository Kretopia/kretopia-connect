-- LOT 0b -- closes what the first catalog query left open. READ-ONLY. Run it in the SQL Editor of "kretopia-app" and paste the result back.
--
-- It shows, for SEC-02, the bodies of the two project triggers that fix and then freeze created_by, and every UPDATE (or ALL) policy of
-- public.projects. For the lot C follow-up it shows whether members can write, today, the three profile columns the app writes itself and
-- the five review candidates (a NULL means the column does not exist).
--
-- Like every catalog query it shows what exists, not how a signed-in caller is treated (the SQL Editor bypasses RLS): the REST calls
-- 3 and 4 of lot0_sec01_sec02_verification.md are what show that.

SELECT 'function_definition' AS section,
       p.oid::regprocedure::text AS object,
       jsonb_build_object('security_definer', p.prosecdef, 'proconfig', p.proconfig, 'definition', pg_get_functiondef(p.oid)) AS detail
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('set_project_created_by', 'guard_project_created_by')
UNION ALL
SELECT 'update_policy',
       pol.polname::text,
       jsonb_build_object(
         'cmd', CASE pol.polcmd WHEN 'w' THEN 'UPDATE' ELSE 'ALL' END,
         'permissive', pol.polpermissive,
         'roles', CASE WHEN pol.polroles = '{0}'::oid[] THEN to_jsonb(ARRAY['public'])
                       ELSE to_jsonb(ARRAY(SELECT r.rolname::text FROM pg_roles r WHERE r.oid = ANY (pol.polroles))) END,
         'using', pg_get_expr(pol.polqual, pol.polrelid),
         'with_check', pg_get_expr(pol.polwithcheck, pol.polrelid))
FROM pg_policy pol
WHERE pol.polrelid = 'public.projects'::regclass AND pol.polcmd IN ('w', '*')
UNION ALL
SELECT 'profiles_column_privilege',
       c.col,
       jsonb_build_object(
         'column_exists', a.attnum IS NOT NULL,
         'authenticated_can_update', CASE WHEN a.attnum IS NULL THEN NULL ELSE has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE') END,
         'authenticated_can_insert', CASE WHEN a.attnum IS NULL THEN NULL ELSE has_column_privilege('authenticated', 'public.profiles', a.attnum, 'INSERT') END)
FROM (VALUES ('is_claimed'), ('current_streak'), ('daily_swipes'), ('project_credits'), ('invited_by'),
             ('invite_code_used'), ('referred_by_ambassador'), ('preferred_currency')) AS c(col)
LEFT JOIN pg_attribute a
  ON a.attrelid = 'public.profiles'::regclass AND a.attname = c.col AND NOT a.attisdropped
ORDER BY 1, 2;
