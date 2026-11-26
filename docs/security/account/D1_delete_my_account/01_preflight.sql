-- LOT D1 -- delete my account -- 01 PREFLIGHT. Read-only: changes nothing and does not raise whatever is or is not there.
-- SQL Editor of "kretopia-app" only. One query on purpose: the editor shows only the result of the last statement.
--
-- Why: the Delete Account button called supabase.auth.admin.deleteUser() from the browser; that needs the service-role key, so
-- production answers 403 not_admin and nobody can delete their account. 02_apply.sql adds public.delete_my_account() instead.
--
-- Statuses: OK = as needed. PROBLEM = read the detail; apply is still safe, but the members it names cannot delete their account yet
-- (they get "account_delete_blocked", nothing is changed for them). INFO = a number or a list, not a verdict.
WITH
fk AS (
  -- Every single-column foreign key to auth.users or profiles that would BLOCK the delete (NO ACTION / RESTRICT).
  SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, a.attnotnull AS not_null, cardinality(c.conkey) AS ncols,
         CASE WHEN c.confrelid = to_regclass('auth.users') THEN 'auth.users' ELSE 'profiles' END AS parent
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f' AND c.confdeltype IN ('a', 'r')
     AND c.confrelid IN (to_regclass('auth.users'), to_regclass('public.profiles'))
),
nofk AS (
  -- Member-keyed columns that have NO foreign key at all: deleting the login leaves these rows behind (not swept by this lot).
  SELECT DISTINCT k.relname AS tbl
    FROM pg_class k JOIN pg_attribute a ON a.attrelid = k.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_type t ON t.oid = a.atttypid AND t.typname = 'uuid'
   WHERE k.relnamespace = 'public'::regnamespace AND k.relkind = 'r'
     AND a.attname IN ('user_id', 'owner_id', 'profile_id', 'sender_id', 'receiver_id', 'author_id', 'created_by', 'buyer_id', 'member_id', 'creator_id')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint f WHERE f.conrelid = k.oid AND f.contype = 'f' AND a.attnum = ANY (f.conkey))
)
SELECT nr, check_name, status, detail FROM (
  SELECT 1 AS nr, 'function public.delete_my_account() is not there yet' AS check_name,
         CASE WHEN to_regprocedure('public.delete_my_account()') IS NULL THEN 'OK' ELSE 'INFO' END AS status,
         CASE WHEN to_regprocedure('public.delete_my_account()') IS NULL THEN 'not applied yet' ELSE 'already applied; 02_apply.sql replaces it in place (CREATE OR REPLACE)' END AS detail
  UNION ALL
  SELECT 2, 'this role can delete from auth.users (needed: the function runs as its owner)',
         CASE WHEN to_regclass('auth.users') IS NOT NULL AND has_table_privilege(current_user, 'auth.users', 'DELETE') THEN 'OK' ELSE 'PROBLEM' END,
         'running as ' || current_user || '; run 02_apply.sql as the same role (postgres in the SQL Editor)'
  UNION ALL
  SELECT 3, 'profiles.user_id has no foreign key to auth.users (dropped by 20251229182924): the function deletes the profile row itself',
         'INFO',
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                            WHERE c.contype = 'f' AND c.conrelid = to_regclass('public.profiles') AND c.confrelid = to_regclass('auth.users')
                              AND a.attname = 'user_id')
              THEN 'a foreign key exists here; the explicit profile delete is harmless either way'
              ELSE 'no foreign key: deleting only the login would leave the profile behind, which is why the function deletes it' END
  UNION ALL
  SELECT 4, 'nullable NO ACTION references: set to NULL by the function (the other record stays, the pointer goes)',
         'INFO',
         coalesce((SELECT string_agg(tbl || '.' || col || ' -> ' || parent, '; ' ORDER BY tbl, col) FROM fk WHERE NOT not_null AND ncols = 1), 'none')
  UNION ALL
  SELECT 100 + row_number() OVER (ORDER BY tbl, col),
         'blocker: ' || tbl || '.' || col || ' -> ' || parent || CASE WHEN ncols > 1 THEN ' (composite)' ELSE ' (NOT NULL)' END,
         CASE WHEN coalesce((xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %s WHERE %I IS NOT NULL', tbl, col), false, true, '')))[1]::text::bigint, 0) > 0
              THEN 'PROBLEM' ELSE 'OK' END,
         'rows that point at a member: ' ||
           coalesce((xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %s WHERE %I IS NOT NULL', tbl, col), false, true, '')))[1]::text, '?')
           || '. A member with such a row gets "account_delete_blocked" until it is handled (reassign or remove it), by hand or in a follow-up lot.'
    FROM fk WHERE not_null OR ncols > 1
  UNION ALL
  SELECT 5, 'member-keyed tables with NO foreign key: NOT removed by this lot (the rows stay, keyed to a login that no longer exists)',
         'INFO',
         (SELECT count(*)::text FROM nofk) || ' tables, e.g. ' || coalesce((SELECT string_agg(tbl, ', ' ORDER BY tbl) FROM (SELECT tbl FROM nofk ORDER BY tbl LIMIT 12) x), 'none')
         || '. See README "Not covered".'
  UNION ALL
  SELECT 6, 'wallets with a balance above zero (the balance is lost with the account)',
         'INFO',
         CASE WHEN to_regclass('public.wallets') IS NOT NULL
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'balance')
              THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.wallets w WHERE (to_jsonb(w) ->> ''balance'')::numeric > 0', false, true, '')))[1]::text
              ELSE 'wallets.balance not found' END
) r ORDER BY nr;
