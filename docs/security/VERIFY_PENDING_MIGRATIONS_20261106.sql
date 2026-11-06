-- READ-ONLY: changes nothing, and never raises an error whatever has or has not been applied. Run it before the migrations (every line it
-- reports about them should say NOT APPLIED) and after (every line should say APPLIED, OK or INFO). It is one query on purpose: the SQL
-- editor shows only the result of the last statement.
--
-- Migrations it covers:
--   supabase/migrations/20261106100000_cosign_recipient_authority.sql        (corrected the same day)
--   supabase/migrations/20261106130000_cosign_submit_raises_guard_flag.sql   (repair, if the first version was applied before its correction)
--   supabase/migrations/20261106120000_featured_in_confirmation_and_role_claim_requests.sql
--
-- Statuses: APPLIED / OK = as intended. NOT APPLIED = the change is not there yet. PROBLEM = something is wrong and needs action (the detail says what).
-- INFO = a number, not a verdict.

WITH
press AS (
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'press_links' AND column_name = 'owner_confirmed_at'
  ) AS has_col
),
fn AS (
  SELECT p.proname, p.prosecdef, pg_get_functiondef(p.oid) AS def, pg_get_function_result(p.oid) AS result
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('submit_credit_endorsement_by_token', 'get_credit_endorsement_by_token', 'claim_icdb_role',
                       'request_icdb_role_claim', 'decide_icdb_role_claim')
),
pol AS (
  SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'press_links'
)
SELECT n, check_name, status, detail
FROM (
  -- Co-Sign ---------------------------------------------------------------------------------------------------------------
  SELECT 1 AS n,
         'Co-Sign: only the member a request was sent to can answer it' AS check_name,
         CASE WHEN EXISTS (SELECT 1 FROM fn WHERE proname = 'submit_credit_endorsement_by_token' AND def LIKE '%not_recipient%')
              THEN 'APPLIED' ELSE 'NOT APPLIED' END AS status,
         'submit_credit_endorsement_by_token refuses anyone but the recipient of a targeted request' AS detail
  UNION ALL
  SELECT 2,
         'Co-Sign: an accepted answer is allowed to update the credit',
         CASE WHEN NOT EXISTS (SELECT 1 FROM fn WHERE proname = 'submit_credit_endorsement_by_token') THEN 'PROBLEM'
              WHEN EXISTS (SELECT 1 FROM fn WHERE proname = 'submit_credit_endorsement_by_token'
                                              AND def LIKE '%app.credit_verification_authorized%') THEN 'OK'
              ELSE 'PROBLEM' END,
         'the function must raise app.credit_verification_authorized before it touches credits, or the credits guard rejects EVERY accepted co-sign. '
         || 'PROBLEM means: apply 20261106130000_cosign_submit_raises_guard_flag.sql now'
  UNION ALL
  SELECT 3,
         'Co-Sign: the request page can tell who may answer',
         CASE WHEN EXISTS (SELECT 1 FROM fn WHERE proname = 'get_credit_endorsement_by_token' AND result LIKE '%can_respond%')
              THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         'get_credit_endorsement_by_token returns addressed_to_member and can_respond'
  UNION ALL
  -- Featured In -----------------------------------------------------------------------------------------------------------
  SELECT 4,
         'Featured In: owner_confirmed_at column',
         CASE WHEN (SELECT has_col FROM press) THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         'a link is shown to other people only once its owner has confirmed it'
  UNION ALL
  SELECT 5,
         'Featured In: visitors see only confirmed links',
         CASE WHEN NOT (SELECT has_col FROM press) THEN 'NOT APPLIED'
              WHEN EXISTS (SELECT 1 FROM pol WHERE cmd = 'SELECT' AND qual = 'true') THEN 'PROBLEM'
              WHEN EXISTS (SELECT 1 FROM pol WHERE policyname = 'Press links: confirmed are public, own are visible to their owner') THEN 'APPLIED'
              ELSE 'NOT APPLIED' END,
         'PROBLEM means an open read policy (USING true) is still there and still shows every link to everyone'
  UNION ALL
  SELECT 6,
         'Featured In: owners can confirm their own links',
         CASE WHEN NOT (SELECT has_col FROM press) THEN 'NOT APPLIED'
              WHEN has_column_privilege('authenticated', 'public.press_links', 'owner_confirmed_at', 'UPDATE') THEN 'APPLIED'
              ELSE 'PROBLEM' END,
         'authenticated members may set owner_confirmed_at (the row policies still limit it to their own rows)'
  UNION ALL
  SELECT 7,
         'Featured In: how many links are confirmed',
         CASE WHEN (SELECT has_col FROM press) THEN 'INFO' ELSE 'NOT APPLIED' END,
         -- to_jsonb reads the column by name, so this line cannot fail when the column does not exist yet.
         (SELECT count(*) FROM public.press_links)::text || ' links, '
         || (SELECT count(*) FROM public.press_links p WHERE (to_jsonb(p) ->> 'owner_confirmed_at') IS NOT NULL)::text
         || ' confirmed by their owner (right after applying, 0 is correct: every member starts from zero)'
  UNION ALL
  -- Role claims -----------------------------------------------------------------------------------------------------------
  SELECT 8,
         'Role claims: the request table',
         CASE WHEN to_regclass('public.icdb_role_claim_requests') IS NOT NULL THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         'a claim is a request an admin decides'
  UNION ALL
  SELECT 9,
         'Role claims: the request and decision functions',
         CASE WHEN (SELECT count(*) FROM fn WHERE proname IN ('request_icdb_role_claim', 'decide_icdb_role_claim') AND prosecdef) = 2
              THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         'request_icdb_role_claim and decide_icdb_role_claim exist and are SECURITY DEFINER'
  UNION ALL
  SELECT 10,
         'Role claims: the old claim function only files a request',
         CASE WHEN EXISTS (SELECT 1 FROM fn WHERE proname = 'claim_icdb_role' AND def LIKE '%request_icdb_role_claim%')
              THEN 'APPLIED' ELSE 'NOT APPLIED' END,
         'until then a member''s Claim button still adds the credit at once'
  UNION ALL
  SELECT 11,
         'Role claims: visitors cannot call the decision function',
         CASE WHEN to_regprocedure('public.decide_icdb_role_claim(uuid,boolean,text)') IS NULL THEN 'NOT APPLIED'
              WHEN has_function_privilege('anon', to_regprocedure('public.decide_icdb_role_claim(uuid,boolean,text)'), 'EXECUTE') THEN 'PROBLEM'
              ELSE 'APPLIED' END,
         'the function also checks for an admin itself; this is the second lock'
  UNION ALL
  SELECT 12,
         'Role claims: nobody can write the queue directly',
         CASE WHEN to_regclass('public.icdb_role_claim_requests') IS NULL THEN 'NOT APPLIED'
              WHEN has_table_privilege('anon', to_regclass('public.icdb_role_claim_requests'), 'SELECT, INSERT, UPDATE, DELETE')
                OR has_table_privilege('authenticated', to_regclass('public.icdb_role_claim_requests'), 'INSERT, UPDATE, DELETE') THEN 'PROBLEM'
              ELSE 'APPLIED' END,
         'writes go only through the two functions; members read their own requests, admins read all'
) checks
ORDER BY n;
