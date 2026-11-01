-- LOT B (waitlist) -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply_waitlist.sql. One result row.
--
-- PROVES (catalog): RLS on; exactly the two new policies with the expected command and roles; the visitor can write exactly the
-- 11 named columns and nothing else; anon holds no read privilege; the review columns are not writable by a visitor; the two bounds
-- exist; whether the rows already stored comply with them.
-- DOES NOT PROVE: how a real anon or signed-in caller is treated. The SQL Editor runs as postgres and bypasses RLS. The six REST
-- calls below are that proof, and they are yours to run.

WITH cols AS (
  SELECT a.attname::text AS col, a.attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.waitlist'::regclass AND a.attnum > 0 AND NOT a.attisdropped
),
visitor_cols AS (
  SELECT unnest(ARRAY['email', 'full_name', 'role', 'instagram_url', 'twitter_url', 'linkedin_url', 'spotify_url', 'website', 'bio', 'why_join', 'status']) AS col
),
pol AS (
  SELECT policyname, cmd, roles::text[] AS roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist'
)
SELECT
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.waitlist'::regclass)                    AS rls_enabled,
  (SELECT count(*) FROM pol) = 2                                                                         AS exactly_two_policies,
  EXISTS (SELECT 1 FROM pol WHERE policyname = 'waitlist_visitor_insert' AND cmd = 'INSERT'
          AND roles @> ARRAY['anon', 'authenticated'] AND cardinality(roles) = 2)                        AS visitor_insert_policy_shape,
  EXISTS (SELECT 1 FROM pol WHERE policyname = 'waitlist_admin_all' AND cmd = 'ALL' AND roles = ARRAY['authenticated']) AS admin_policy_shape,
  (SELECT bool_and(has_column_privilege('anon', 'public.waitlist', v.col, 'INSERT')) FROM visitor_cols v)  AS anon_can_insert_the_11_columns,
  (SELECT bool_and(has_column_privilege('authenticated', 'public.waitlist', v.col, 'INSERT')) FROM visitor_cols v) AS signed_in_can_insert_the_11_columns,
  NOT EXISTS (SELECT 1 FROM cols c WHERE c.col NOT IN (SELECT col FROM visitor_cols)
              AND (has_column_privilege('anon', 'public.waitlist', c.col, 'INSERT')
                   OR has_column_privilege('authenticated', 'public.waitlist', c.col, 'INSERT')))        AS no_other_column_is_writable_by_a_visitor,
  NOT has_any_column_privilege('anon', 'public.waitlist', 'SELECT')                                      AS anon_cannot_read_any_column,
  NOT has_any_column_privilege('anon', 'public.waitlist', 'UPDATE')                                      AS anon_cannot_update,
  NOT has_table_privilege('anon', 'public.waitlist', 'DELETE')                                           AS anon_cannot_delete,
  has_table_privilege('service_role', 'public.waitlist', 'SELECT, INSERT, UPDATE, DELETE')               AS service_role_keeps_access,
  (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.waitlist'::regclass
     AND conname IN ('waitlist_email_shape', 'waitlist_text_bounds')) = 2                                AS both_bounds_present,
  (SELECT bool_and(convalidated) FROM pg_constraint WHERE conrelid = 'public.waitlist'::regclass
     AND conname IN ('waitlist_email_shape', 'waitlist_text_bounds'))                                    AS informational_bounds_validated_for_stored_rows,
  (SELECT count(*) FROM public.waitlist WHERE NOT (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@<>"]+@[^[:space:]@<>"]+\.[^[:space:]@<>"]+$')) AS informational_stored_rows_with_a_bad_email;

-- ---------------------------------------------------------------------------------------------------------------------
-- The proof the catalog cannot give: six REST calls, by hand. {URL} = the project URL, {ANON} = its public anon key (no secret),
-- {ADMIN_TOKEN} / {USER_TOKEN} = access tokens of an admin and of an ordinary member (never pasted into a chat).
--
-- 1. A visitor joins:                 POST {URL}/rest/v1/waitlist      apikey/Bearer {ANON}      Content-Type: application/json
--      {"email":"probe1@example.test","full_name":"Probe","role":"Editor","status":"review"}      -> 201
-- 2. A visitor tries to approve self: same call with  {"email":"probe2@example.test","full_name":"Probe","role":"Editor","status":"approved"}
--                                                                                                   -> 403  (row-level security)
-- 3. A visitor sets the review state: same call with  {... ,"invite_code":"X","ai_decision":"approve"}
--                                                                                                   -> 401/403  "permission denied for table waitlist"
-- 4. A visitor reads the list:        GET  {URL}/rest/v1/waitlist?select=email       apikey/Bearer {ANON}        -> 401 (42501)
-- 5. A member reads the list:         GET  same, Bearer {USER_TOKEN}                                              -> 200 with []  (RLS filters every row)
-- 6. An admin reads and decides:      GET  same, Bearer {ADMIN_TOKEN} -> 200 with the rows;
--                                     PATCH {URL}/rest/v1/waitlist?email=eq.probe1@example.test  {"status":"approved"}  -> 200/204
--    Then remove the probe rows as an admin (DELETE ... ?email=like.probe*@example.test).
-- ---------------------------------------------------------------------------------------------------------------------
