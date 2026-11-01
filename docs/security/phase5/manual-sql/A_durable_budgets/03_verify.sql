-- LOT A -- durable budgets -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app", after 02_apply.sql.
-- One result row. Every column must be true (the two informational columns at the end are not checks).
--
-- WHAT THIS PROVES: the catalog state -- the objects, their constraints, their owner-level settings, who holds which privilege.
-- WHAT THIS DOES NOT PROVE: (1) that the limit holds under many simultaneous callers (05_CONCURRENCY_TEST.md, on an isolated
-- database); (2) how PostgREST treats a real anon or signed-in caller -- the SQL Editor runs as postgres and bypasses RLS, so
-- "anon cannot execute" is read here from the privilege tables, and is only SEEN once with the REST call in the same file's
-- last section.

WITH
fn AS (
  SELECT p.proname, p.oid, p.prosecdef, p.proconfig, p.proacl, p.oid::regprocedure::text AS signature
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('reserve_budget', 'commit_budget', 'release_budget')
),
tb AS (
  SELECT c.relname, c.oid, c.relrowsecurity, c.relacl
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('budget_buckets', 'budget_reservations') AND c.relkind = 'r'
),
cons AS (
  SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace
)
SELECT
  (SELECT count(*) FROM tb) = 2                                                                  AS two_tables_exist,
  (SELECT bool_and(relrowsecurity) FROM tb)                                                      AS rls_enabled_on_both,
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('budget_buckets', 'budget_reservations'))
                                                                                                 AS no_policy_so_clients_are_denied,
  (SELECT count(*) FROM fn) = 3                                                                  AS three_functions_exist,
  (SELECT bool_and(prosecdef) FROM fn)                                                           AS all_security_definer,
  (SELECT bool_and(proconfig IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%')) FROM fn)
                                                                                                 AS search_path_pinned,
  (SELECT bool_and(NOT has_function_privilege('anon', oid, 'EXECUTE')) FROM fn)                  AS anon_cannot_execute,
  (SELECT bool_and(NOT has_function_privilege('authenticated', oid, 'EXECUTE')) FROM fn)         AS authenticated_cannot_execute,
  (SELECT bool_and(has_function_privilege('service_role', oid, 'EXECUTE')) FROM fn)              AS service_role_can_execute,
  (SELECT bool_and(proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee = 0)) FROM fn)
                                                                                                 AS public_pseudo_role_cannot_execute,
  (SELECT bool_and(NOT has_table_privilege('anon', oid, 'SELECT, INSERT, UPDATE, DELETE')
                   AND NOT has_table_privilege('authenticated', oid, 'SELECT, INSERT, UPDATE, DELETE')) FROM tb)
                                                                                                 AS clients_have_no_table_privilege,
  (SELECT bool_and(has_table_privilege('service_role', oid, 'SELECT')) FROM tb)                  AS service_role_can_read_for_monitoring,
  EXISTS (SELECT 1 FROM cons WHERE conname = 'budget_buckets_never_over_limit')                  AS overshoot_is_impossible_by_constraint,
  (SELECT count(*) FROM cons WHERE conname IN (
     'budget_buckets_pkey', 'budget_buckets_key_length', 'budget_buckets_limit_not_negative', 'budget_buckets_counts_not_negative',
     'budget_buckets_never_over_limit', 'budget_reservations_bucket_fkey', 'budget_reservations_units_positive',
     'budget_reservations_status_known', 'budget_reservations_settled_iff_closed')) = 9          AS nine_constraints_present,
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('budget_reservations_open_idx', 'budget_buckets_window_idx')) = 2
                                                                                                 AS two_indexes_present,
  NOT EXISTS (SELECT 1 FROM public.budget_buckets) AND NOT EXISTS (SELECT 1 FROM public.budget_reservations)
                                                                                                 AS tables_empty_after_apply,
  current_user                                                                                   AS informational_running_as,
  'concurrency and real-JWT behaviour are NOT proved by this query'                              AS informational_limit;

-- ---------------------------------------------------------------------------------------------------------------------
-- The one thing the catalog cannot show, with a real REST call (run by hand, with the project's PUBLIC anon key; no secret):
--
--   POST {URL}/rest/v1/rpc/reserve_budget
--   apikey: {ANON}      Authorization: Bearer {ANON}      Content-Type: application/json
--   {"p_bucket": "verify:anon", "p_window_seconds": 60, "p_limit": 1, "p_units": 1}
--
--   Expected: HTTP 401  {"code":"42501", ... "permission denied for function reserve_budget"}
--   A 200 means anon can reserve budget: run 04_rollback.sql and do not go on.
-- ---------------------------------------------------------------------------------------------------------------------
