-- READ-ONLY. Nothing here changes data or schema. Run it in the SQL editor of the backend you applied the two migrations to
-- (production's legacy backend), after applying them. Each block says what a correct answer looks like.
-- Migrations covered:
--   supabase/migrations/20261106100000_cosign_recipient_authority.sql
--   supabase/migrations/20261106120000_featured_in_confirmation_and_role_claim_requests.sql

-- 1. Co-Sign: the read function returns the two new columns, and the submit function checks the recipient.
--    Expected: get_returns ends with "addressed_to_member boolean, can_respond boolean"; submit_checks_recipient = true.
SELECT
  (SELECT pg_get_function_result(oid) FROM pg_proc
    WHERE proname = 'get_credit_endorsement_by_token' AND pronamespace = 'public'::regnamespace) AS get_returns,
  (SELECT position('not_recipient' IN pg_get_functiondef(oid)) > 0 FROM pg_proc
    WHERE proname = 'submit_credit_endorsement_by_token' AND pronamespace = 'public'::regnamespace) AS submit_checks_recipient;

-- 2. Featured In: the column exists, owners may set it, and the only SELECT policy hides unconfirmed rows from other people.
--    Expected: 1 row for the column; owner_can_update = true; one SELECT policy whose qual mentions owner_confirmed_at
--    (a policy with qual = true would mean the old open policy is still there).
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'press_links' AND column_name = 'owner_confirmed_at';
SELECT has_column_privilege('authenticated', 'public.press_links', 'owner_confirmed_at', 'UPDATE') AS owner_can_update;
SELECT policyname, roles, qual FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'press_links' AND cmd = 'SELECT';

-- 3. Featured In starts from zero. Expected right after applying: confirmed = 0. It rises only as members press "This is me".
SELECT count(*) AS press_rows, count(owner_confirmed_at) AS confirmed FROM public.press_links;

-- 4. Role claims: the request table and the three functions exist, are SECURITY DEFINER, and the old claim function only files a request.
--    Expected: table_exists = true; 3 rows with prosecdef = true; old_claim_files_request = true; anon_can_decide = false.
SELECT to_regclass('public.icdb_role_claim_requests') IS NOT NULL AS table_exists;
SELECT proname, prosecdef FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('request_icdb_role_claim', 'decide_icdb_role_claim', 'claim_icdb_role')
 ORDER BY proname;
SELECT position('request_icdb_role_claim' IN pg_get_functiondef('public.claim_icdb_role(uuid,text)'::regprocedure)) > 0 AS old_claim_files_request;
SELECT has_function_privilege('anon', 'public.decide_icdb_role_claim(uuid,boolean,text)', 'EXECUTE') AS anon_can_decide;

-- 5. The review queue. Pending requests wait for an admin to call decide_icdb_role_claim(request_id, true|false, note).
SELECT status, count(*) FROM public.icdb_role_claim_requests GROUP BY status ORDER BY status;
