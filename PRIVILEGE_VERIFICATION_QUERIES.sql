-- ============================================================
-- PRIVILEGE_VERIFICATION_QUERIES.sql
--
-- Read-only. Every statement here is a SELECT / catalog inspection —
-- nothing modifies a row, a privilege, or a schema object. Safe to run
-- against production. Written to distinguish, for each of
-- public.wallets / public.creator_wallets / public.profiles:
--   table-level privilege vs. column-level privilege vs. PUBLIC-role
--   privilege vs. a directly-named role's privilege vs. the *effective*
--   privilege a session would actually get vs. what RLS separately
--   allows vs. what a SECURITY DEFINER RPC can still do regardless.
--
-- None of these return customer data, wallet balances, or secrets —
-- every query targets catalog/metadata objects (information_schema,
-- pg_class, pg_attribute, pg_policies, pg_proc), never table rows.
-- ============================================================


-- ------------------------------------------------------------
-- 1. EFFECTIVE privilege check — the single most authoritative answer.
-- has_table_privilege / has_column_privilege ask Postgres directly
-- "can this role actually do this," folding in every source (direct
-- grant, PUBLIC grant, role membership/inheritance) — this is what
-- actually governs behavior, more reliable than reading ACL text.
-- ------------------------------------------------------------

SELECT 'wallets' AS tbl, 'authenticated' AS role, has_table_privilege('authenticated', 'public.wallets', 'UPDATE') AS table_level_update
UNION ALL SELECT 'wallets', 'anon', has_table_privilege('anon', 'public.wallets', 'UPDATE')
UNION ALL SELECT 'wallets', 'PUBLIC', has_table_privilege('public', 'public.wallets', 'UPDATE')
UNION ALL SELECT 'creator_wallets', 'authenticated', has_table_privilege('authenticated', 'public.creator_wallets', 'UPDATE')
UNION ALL SELECT 'creator_wallets', 'anon', has_table_privilege('anon', 'public.creator_wallets', 'UPDATE')
UNION ALL SELECT 'creator_wallets', 'PUBLIC', has_table_privilege('public', 'public.creator_wallets', 'UPDATE')
UNION ALL SELECT 'profiles', 'authenticated', has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
UNION ALL SELECT 'profiles', 'anon', has_table_privilege('anon', 'public.profiles', 'UPDATE')
UNION ALL SELECT 'profiles', 'PUBLIC', has_table_privilege('public', 'public.profiles', 'UPDATE');
-- has_table_privilege = true here means the role can UPDATE *some*
-- column of the table at the grant/ACL layer, independent of RLS and
-- independent of whether a column-level REVOKE was ever run — this is
-- the query that answers "is a table-level grant present" directly.

SELECT 'wallets.balance' AS col, 'authenticated' AS role, has_column_privilege('authenticated', 'public.wallets', 'balance', 'UPDATE') AS can_update
UNION ALL SELECT 'wallets.credits', 'authenticated', has_column_privilege('authenticated', 'public.wallets', 'credits', 'UPDATE')
UNION ALL SELECT 'creator_wallets.kyc_status', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'kyc_status', 'UPDATE')
UNION ALL SELECT 'creator_wallets.payouts_enabled', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'payouts_enabled', 'UPDATE')
UNION ALL SELECT 'creator_wallets.charges_enabled', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'charges_enabled', 'UPDATE')
UNION ALL SELECT 'creator_wallets.stripe_account_id', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'stripe_account_id', 'UPDATE')
UNION ALL SELECT 'creator_wallets.requirements', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'requirements', 'UPDATE')
UNION ALL SELECT 'profiles.stripe_account_id', 'authenticated', has_column_privilege('authenticated', 'public.profiles', 'stripe_account_id', 'UPDATE')
UNION ALL SELECT 'profiles.stripe_account_status', 'authenticated', has_column_privilege('authenticated', 'public.profiles', 'stripe_account_status', 'UPDATE');
-- has_column_privilege returns TRUE if EITHER a column-level grant OR a
-- table-level grant permits it — it does not distinguish source. If
-- this is true while a column-level REVOKE was issued for that exact
-- column, and query 1 above also shows table-level UPDATE = true for
-- that role, the table-level grant is what's actually letting it
-- through — this pairing of results is the diagnostic.


-- ------------------------------------------------------------
-- 2. Table-level grants, explicitly, from the catalog view built for
-- exactly this (distinct from column_privileges, which reports
-- per-column and can conflate the two sources if read carelessly).
-- ------------------------------------------------------------

SELECT grantee, table_name, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('wallets', 'creator_wallets', 'profiles')
  AND privilege_type = 'UPDATE'
  AND grantee IN ('authenticated', 'anon', 'PUBLIC')
ORDER BY table_name, grantee;
-- Any row here is an unambiguous TABLE-LEVEL UPDATE grant. A
-- column-level REVOKE never removes a row from this view — it isn't
-- capable of touching a table-level grant at all. If this returns any
-- row for wallets/creator_wallets/profiles + authenticated or anon,
-- that is the root cause, full stop, regardless of what any
-- column-level REVOKE was ever run.


-- ------------------------------------------------------------
-- 3. Column-level grants specifically (refined from the earlier check
-- to isolate privilege_type = UPDATE, since the unfiltered version
-- previously returned a harmless SELECT row alongside the real finding).
-- ------------------------------------------------------------

SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND (
    (table_name = 'wallets' AND column_name IN ('balance', 'credits'))
    OR (table_name = 'creator_wallets' AND column_name IN ('kyc_status', 'payouts_enabled', 'charges_enabled', 'stripe_account_id', 'requirements'))
    OR (table_name = 'profiles' AND column_name IN ('stripe_account_id', 'stripe_account_status'))
  )
  AND privilege_type = 'UPDATE'
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, column_name, grantee;
-- NOTE: in PostgreSQL, information_schema.column_privileges is
-- documented to report privileges "granted to, or by, a currently
-- enabled role" and, per the SQL standard view it implements, is
-- expected to surface the *effective* per-column privilege — which
-- includes privileges conferred by a table-level grant, decomposed per
-- column. If query 2 above shows a table-level grant exists, expect
-- this query to show every column of that table regardless of any
-- column-level REVOKE — that is not a bug in the REVOKE, it is this
-- view correctly reporting that the table-level grant still applies.


-- ------------------------------------------------------------
-- 4. Raw ACL inspection — ground truth, no view abstraction. Shows
-- the actual stored ACL entries: relacl for table-level, and each
-- column's attacl for column-level. This is what queries 1-3 are all
-- ultimately derived from.
-- ------------------------------------------------------------

SELECT relname AS table_name, relacl
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('wallets', 'creator_wallets', 'profiles');
-- Read relacl as a list of "grantee=privileges/grantor" entries, e.g.
-- "authenticated=arwdDxt/postgres" — the letters after "=" are the
-- privilege codes (a=INSERT, r=SELECT, w=UPDATE, d=DELETE, etc.). A "w"
-- for authenticated here is an unambiguous table-level UPDATE grant.

SELECT c.relname AS table_name, a.attname AS column_name, a.attacl
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('wallets', 'creator_wallets', 'profiles')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attacl IS NOT NULL
ORDER BY c.relname, a.attname;
-- Only columns with an explicit column-level ACL entry appear here at
-- all — a NULL attacl (most columns, most of the time) means that
-- column has never had a column-specific grant/revoke; its privilege
-- comes entirely from the table-level relacl above. If a column named
-- in this session's REVOKE statements does NOT appear here, the REVOKE
-- had nothing column-specific to remove, and the table-level grant
-- (if any) is the sole and unaffected source of access to it.


-- ------------------------------------------------------------
-- 5. Default privileges — would a *new* column added to one of these
-- tables, or a newly created table, automatically inherit broad access?
-- This does not explain a change to an *existing* column's privileges,
-- but is relevant to whether the same class of gap could reappear.
-- ------------------------------------------------------------

SELECT
  pg_get_userbyid(d.defaclrole) AS default_grantor,
  n.nspname AS schema,
  d.defaclobjtype AS object_type,  -- 'r' = relation/table
  d.defaclacl AS default_acl
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public';
-- If this returns a row for object_type='r' (tables) with authenticated
-- or anon holding 'w' (UPDATE) in default_acl, every NEW table created
-- in this schema inherits table-level UPDATE for that role
-- automatically, unless explicitly revoked per-table afterward — this
-- is standard Supabase project bootstrapping (ALTER DEFAULT PRIVILEGES
-- ... GRANT ALL ON TABLES TO anon, authenticated, service_role,
-- typically set once at project creation, outside any tracked
-- migration file) and would explain why wallets/profiles never needed
-- an explicit GRANT UPDATE statement in this repo's migration history
-- to already have table-level UPDATE for authenticated.


-- ------------------------------------------------------------
-- 6. RLS policies currently defined — a separate, independent layer
-- from GRANT/REVOKE. Both a GRANT/ACL check AND a satisfied RLS USING
-- clause are required for an UPDATE to actually succeed; this
-- investigation is about the GRANT layer, but confirming RLS is
-- unrelated-and-still-correct rules out RLS itself as a contributing
-- factor.
-- ------------------------------------------------------------

SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('wallets', 'creator_wallets', 'profiles')
  AND cmd IN ('UPDATE', 'ALL')
ORDER BY tablename, policyname;
-- Expected (per this session's earlier reads of the migration files):
-- "Users can update their own wallet" / "own wallet update" / "Users
-- can update own profile", each USING (auth.uid() = user_id), no
-- WITH CHECK. These are unaffected by anything in this investigation —
-- RLS scopes *which rows*, GRANT/REVOKE scopes *whether the operation
-- is allowed at all*. A user can only ever exploit the GRANT-layer gap
-- on their OWN row, per these policies, which is exactly what the
-- original findings (KP-01/KP-02) already established.


-- ------------------------------------------------------------
-- 7. SECURITY DEFINER RPC path — confirm the intended safe write path
-- remains correctly restricted regardless of anything found above.
-- ------------------------------------------------------------

SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('wallet_debit', 'wallet_credit')
  AND r.rolname IN ('authenticated', 'anon', 'service_role', 'PUBLIC')
ORDER BY p.proname, r.rolname;
-- Expected: only service_role shows can_execute = true. This path does
-- not depend on the wallets/creator_wallets/profiles table-level or
-- column-level grants at all — SECURITY DEFINER functions execute with
-- the function owner's privileges, not the caller's, so this should
-- read exactly the same regardless of what queries 1-4 show.

SELECT p.prosecdef AS is_security_definer, p.proconfig AS search_path_setting
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('wallet_debit', 'wallet_credit', 'accept_application', 'notify_application_status', 'notify_new_application');
-- Confirms prosecdef = true (SECURITY DEFINER) and proconfig contains
-- search_path=public for each — both already reviewed by direct source
-- read in KREPAY_CRITICAL_SECURITY_RUNBOOK.md §8; this is the
-- live-catalog cross-check of that same claim.
