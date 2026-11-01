-- LOT B -- privacy rules -- 00 DISCOVERY. Read-only. One statement, one result. Changes nothing.
-- Run it in the SQL Editor of "kretopia-app" (the one that reaches production). Paste the result back.
--
-- Why this exists: the seven privacy alerts are known to the dashboard, not to the repository, and the repository is not a faithful
-- picture of production (policies were applied by hand). Writing a policy for a table whose contract is not known would be a guess,
-- so this lists, from the REAL catalog, every table in `public` that is worth a decision:
--   * RLS is off while anon or authenticated holds a table privilege;
--   * a PERMISSIVE policy for public/anon/authenticated whose test is literally true (USING true, or WITH CHECK true);
--   * columns whose names look personal or secret that anon can read.
-- One row per table with at least one finding, most serious first. For each row decide with DECISIONS.md: what stays public, what
-- is projected (a view or a column list), what is closed. Lot B ships one table whose contract is already stated: waitlist.

WITH tbl AS (
  SELECT c.oid, c.relname::text AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
privs AS (
  SELECT t.oid,
         concat_ws(',',
           CASE WHEN has_table_privilege('anon', t.oid, 'SELECT') THEN 'SELECT' END,
           CASE WHEN has_table_privilege('anon', t.oid, 'INSERT') THEN 'INSERT' END,
           CASE WHEN has_table_privilege('anon', t.oid, 'UPDATE') THEN 'UPDATE' END,
           CASE WHEN has_table_privilege('anon', t.oid, 'DELETE') THEN 'DELETE' END) AS anon_privileges,
         concat_ws(',',
           CASE WHEN has_table_privilege('authenticated', t.oid, 'SELECT') THEN 'SELECT' END,
           CASE WHEN has_table_privilege('authenticated', t.oid, 'INSERT') THEN 'INSERT' END,
           CASE WHEN has_table_privilege('authenticated', t.oid, 'UPDATE') THEN 'UPDATE' END,
           CASE WHEN has_table_privilege('authenticated', t.oid, 'DELETE') THEN 'DELETE' END) AS authenticated_privileges
  FROM tbl t
),
loose AS (
  SELECT p.tablename::text AS table_name,
         jsonb_agg(jsonb_build_object(
           'policy', p.policyname, 'cmd', p.cmd, 'roles', p.roles::text[], 'using', p.qual, 'with_check', p.with_check
         ) ORDER BY p.policyname) AS policies
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.permissive = 'PERMISSIVE'
    AND p.roles::text[] && ARRAY['public', 'anon', 'authenticated']
    AND (
      (p.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') AND lower(regexp_replace(coalesce(p.qual, ''), '[()\s]', '', 'g')) = 'true')
      OR (p.cmd IN ('INSERT', 'UPDATE', 'ALL') AND lower(regexp_replace(coalesce(p.with_check, ''), '[()\s]', '', 'g')) = 'true')
    )
  GROUP BY p.tablename
),
exposed AS (
  SELECT t.table_name, array_agg(a.attname::text ORDER BY a.attnum) AS columns
  FROM tbl t
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE a.attname ~* '(email|phone|token|secret|passw|api_?key|address|birth|dob|ssn|iban|account_number|routing|stripe|ip_?addr|otp|salary|invite_code|claim)'
    AND has_column_privilege('anon', t.oid, a.attnum, 'SELECT')
  GROUP BY t.table_name
)
SELECT
  t.table_name,
  t.rls_enabled,
  pr.anon_privileges,
  pr.authenticated_privileges,
  l.policies AS permissive_policies_that_are_literally_true,
  e.columns  AS personal_looking_columns_anon_can_read
FROM tbl t
JOIN privs pr ON pr.oid = t.oid
LEFT JOIN loose l ON l.table_name = t.table_name
LEFT JOIN exposed e ON e.table_name = t.table_name
WHERE (NOT t.rls_enabled AND (pr.anon_privileges <> '' OR pr.authenticated_privileges <> ''))
   OR l.policies IS NOT NULL
   OR e.columns IS NOT NULL
ORDER BY (NOT t.rls_enabled) DESC, (e.columns IS NOT NULL) DESC, (l.policies IS NOT NULL) DESC, t.table_name;
