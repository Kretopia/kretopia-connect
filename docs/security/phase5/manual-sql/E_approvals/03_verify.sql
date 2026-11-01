-- LOT E -- agent approvals -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql. One result row.
--
-- PROVES (catalog): the guard function and its trigger exist and are enabled on the right columns; the unique partial index exists and is
-- unique; the insert policy is the new one, for authenticated only, and the old one is gone; no action has two positive approvals.
-- DOES NOT PROVE: that the transitions behave as intended (05_CONCURRENCY_TEST.md runs them, on an isolated database) or how PostgREST
-- answers a real member (the REST call below).

SELECT
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'guard_orch_action_transitions')
                                                                                                         AS guard_function_exists,
  EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.orch_actions'::regclass AND t.tgname = 'trg_guard_orch_action_transitions'
          AND NOT t.tgisinternal AND t.tgenabled = 'O'
          AND pg_get_triggerdef(t.oid) ILIKE '%BEFORE UPDATE OF status, user_id, tool_name, tool_args, run_id, risk_level%')
                                                                                                         AS guard_trigger_enabled_on_the_right_columns,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orch_approvals'
          AND indexname = 'orch_approvals_one_positive_per_action' AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
          AND indexdef ILIKE '%WHERE%')                                                                  AS one_positive_approval_index,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals'
          AND policyname = 'Users insert own approvals for own actions' AND cmd = 'INSERT' AND roles::text[] = ARRAY['authenticated']
          AND with_check ILIKE '%orch_actions%' AND with_check ILIKE '%auth.uid()%')                     AS own_action_insert_policy,
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals' AND policyname = 'Users insert own orch approvals')
                                                                                                         AS old_insert_policy_gone,
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orch_approvals'
              AND cmd IN ('INSERT', 'ALL') AND policyname <> 'Users insert own approvals for own actions')  AS no_other_way_in,
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.orch_approvals'::regclass)              AS rls_enabled_on_approvals,
  NOT EXISTS (SELECT 1 FROM public.orch_approvals WHERE decision IN ('approved', 'edited') GROUP BY action_id HAVING count(*) > 1)
                                                                                                         AS no_action_has_two_positive_approvals,
  NOT has_table_privilege('anon', 'public.orch_approvals', 'INSERT')                                      AS anon_cannot_insert_approvals;

-- By hand, as ordinary member A, with an action id that belongs to ANOTHER member B (an id you read from B's own session in a test account):
--   POST {URL}/rest/v1/orch_approvals     apikey: {ANON}   Authorization: Bearer {A_TOKEN}   Content-Type: application/json
--   {"action_id":"{B_ACTION_ID}","user_id":"{A_UID}","decision":"rejected"}
--   Expected: HTTP 403 {"code":"42501", ... "new row violates row-level security policy for table \"orch_approvals\""}
--   (before the lot this answered 201 and the rejection blocked B's action).
--   And with A's own action id the same call is accepted (201): a member can still reject their own proposal.
