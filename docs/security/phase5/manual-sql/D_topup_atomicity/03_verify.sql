-- LOT D -- one-time consumption of a wallet top-up -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql.
-- One result row; every column except the informational ones must be true.
--
-- PROVES (catalog): the function exists, is SECURITY DEFINER with a pinned search_path, only the service role can execute it; the unique
-- partial index and the status constraint exist and the constraint is validated; no row broke them.
-- DOES NOT PROVE: that two simultaneous completions credit once (05_CONCURRENCY_TEST.md, on an isolated database) or how PostgREST
-- answers an anon caller (the REST call below). Nothing calls the function yet: the code change comes after the concurrency test.

WITH fn AS (
  SELECT p.oid, p.prosecdef, p.proconfig, p.proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'complete_wallet_topup' AND p.pronargs = 3
)
SELECT
  (SELECT count(*) FROM fn) = 1                                                                      AS function_exists,
  (SELECT bool_and(prosecdef) FROM fn)                                                               AS security_definer,
  (SELECT bool_and(EXISTS (SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%')) FROM fn) AS search_path_pinned,
  (SELECT bool_and(NOT has_function_privilege('anon', oid, 'EXECUTE')) FROM fn)                      AS anon_cannot_execute,
  (SELECT bool_and(NOT has_function_privilege('authenticated', oid, 'EXECUTE')) FROM fn)             AS authenticated_cannot_execute,
  (SELECT bool_and(has_function_privilege('service_role', oid, 'EXECUTE')) FROM fn)                  AS service_role_can_execute,
  (SELECT bool_and(proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee = 0)) FROM fn)
                                                                                                     AS public_pseudo_role_cannot_execute,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'wallet_topups_gateway_payment_unique'
          AND indexdef ILIKE 'CREATE UNIQUE INDEX%' AND indexdef ILIKE '%gateway_payment_id IS NOT NULL%')
                                                                                                     AS one_payment_one_topup_index,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.wallet_topups'::regclass
          AND conname = 'wallet_topups_status_known' AND convalidated)                                AS status_constraint_validated,
  NOT EXISTS (SELECT 1 FROM public.wallet_topups WHERE gateway_payment_id IS NOT NULL
              GROUP BY gateway_payment_id HAVING count(*) > 1)                                       AS no_payment_id_on_two_topups,
  (SELECT count(*) FROM public.wallets WHERE balance < 0) = 0                                        AS no_negative_balance,
  (SELECT count(*) FROM public.wallet_topups WHERE status = 'pending')                               AS informational_pending_topups;

-- The REST call the catalog cannot replace (by hand, with the PUBLIC anon key; no secret):
--   POST {URL}/rest/v1/rpc/complete_wallet_topup      apikey: {ANON}   Authorization: Bearer {ANON}   Content-Type: application/json
--   {"p_topup_id":"00000000-0000-4000-8000-000000000000","p_user_id":"00000000-0000-4000-8000-000000000000","p_gateway_payment_id":"probe"}
--   Expected: HTTP 401 {"code":"42501", ... "permission denied for function complete_wallet_topup"}.  A 404 or a body that talks about a
--   missing top-up means anon reached the function: run 04_rollback.sql.
