-- LOT D1 -- 03 VERIFY. Read-only. Proves the function and its grants are as intended: no line may say FAIL.
-- WARN is not a defect of the function: it names what 01_preflight.sql called a blocker (a NOT NULL reference that makes the delete
-- fail for the members who have such a row). It stays WARN until that column is handled.
-- It deliberately does NOT call the function: that deletes a login. The end-to-end proof is by hand with a QA account (README, "By hand").
SELECT CASE WHEN ok THEN 'PASS' WHEN warning THEN 'WARN' ELSE 'FAIL' END AS result, name
FROM (
  SELECT 'function public.delete_my_account() exists' AS name, false AS warning,
         (to_regprocedure('public.delete_my_account()') IS NOT NULL) AS ok
  UNION ALL SELECT 'it is SECURITY DEFINER', false,
         coalesce((SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.delete_my_account()')), false)
  UNION ALL SELECT 'its search_path is pinned (public, auth, pg_temp)', false,
         coalesce((SELECT 'search_path=public, auth, pg_temp' = ANY (proconfig) FROM pg_proc WHERE oid = to_regprocedure('public.delete_my_account()')), false)
  UNION ALL SELECT 'a signed-in member (authenticated) can call it', false,
         coalesce(has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE'), false)
  UNION ALL SELECT 'anon cannot call it', false,
         coalesce(NOT has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'), false)
  UNION ALL SELECT 'PUBLIC has no grant on it', false,
         coalesce(NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                               WHERE p.oid = to_regprocedure('public.delete_my_account()') AND a.grantee = 0), false)
  UNION ALL SELECT 'its owner can delete from auth.users', false,
         coalesce((SELECT has_table_privilege(proowner, 'auth.users', 'DELETE') FROM pg_proc WHERE oid = to_regprocedure('public.delete_my_account()')), false)
  UNION ALL SELECT 'it deletes the member''s profile row itself (profiles.user_id has no foreign key to auth.users)', false,
         coalesce((SELECT prosrc LIKE '%DELETE FROM public.profiles WHERE user_id = v_uid%' FROM pg_proc WHERE oid = to_regprocedure('public.delete_my_account()')), false)
  UNION ALL SELECT 'no NOT NULL / composite NO ACTION reference to auth.users or profiles is left (it would block the delete for members with such a row)', true,
         NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                      WHERE c.contype = 'f' AND c.confdeltype IN ('a', 'r')
                        AND c.confrelid IN (to_regclass('auth.users'), to_regclass('public.profiles'))
                        AND (a.attnotnull OR cardinality(c.conkey) > 1))
) c
ORDER BY ok, name;
