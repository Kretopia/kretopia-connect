-- LOT B (waitlist) -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- The contract this lot applies to public.waitlist (stated by the product owner, and matching what the app does):
--   * a VISITOR may add themselves (WaitlistForm inserts anonymously): INSERT stays open, but only for the visitor's own fields;
--     they can never set the review state (status beyond pending/review, reviewer, AI score or decision, invite code).
--   * nobody but an admin reads, updates or deletes entries (WaitlistAdmin); the service role keeps full access.
--   * the exposed columns are bounded: a visitor can write 11 named columns and read none.
--
-- It stops with an error if the table is not what this lot expects, if a policy exists that this lot does not know (so that no
-- unknown policy is ever dropped by accident), or if the names it creates are taken. A result row means "go on".

DO $preflight$
DECLARE
  v_expected text[] := ARRAY['id', 'email', 'full_name', 'role', 'instagram_url', 'twitter_url', 'linkedin_url', 'spotify_url',
                             'website', 'bio', 'why_join', 'status', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
                             'ai_score', 'ai_decision', 'ai_reasoning', 'invite_code', 'invite_sent_at'];
  v_known_policies text[] := ARRAY[
    'Anyone can submit to waitlist', 'Authenticated users can submit to waitlist', 'Users can submit to waitlist',
    'Users can view their own waitlist entry', 'Only user and admins view waitlist entries', 'Users can view own waitlist entry',
    'Admins can view all waitlist entries', 'Anyone can view waitlist', 'Waitlist is viewable by admins',
    'Only admins can view waitlist', 'Admins can view waitlist'];
  v_missing text;
  v_unexpected text;
  v_unknown text;
BEGIN
  IF to_regclass('public.waitlist') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.waitlist does not exist here. Nothing was changed.';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.waitlist'::regclass) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: RLS is OFF on public.waitlist. Enable it first and decide what that exposes before this lot. Nothing was changed.';
  END IF;

  SELECT string_agg(x, ', ') INTO v_missing FROM unnest(v_expected) x
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = x);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: expected column(s) missing from public.waitlist: %. The table is not the one this lot was written for. Nothing was changed.', v_missing;
  END IF;

  SELECT string_agg(column_name, ', ') INTO v_unexpected FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'waitlist' AND NOT (column_name = ANY (v_expected));
  IF v_unexpected IS NOT NULL THEN
    RAISE NOTICE 'NOTE: columns this lot does not know: %. They will NOT be writable by visitors after the lot; read the result of the check below.', v_unexpected;
  END IF;

  SELECT string_agg(policyname, ', ') INTO v_unknown FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'waitlist' AND NOT (policyname = ANY (v_known_policies));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: policy(ies) on public.waitlist that this lot does not know: %. Read them (query below), decide, then extend v_known_policies in 02_apply.sql. Nothing was changed.', v_unknown;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist' AND policyname IN ('waitlist_visitor_insert', 'waitlist_admin_all')) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: a policy of the new names already exists on public.waitlist. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.waitlist'::regclass AND conname IN ('waitlist_email_shape', 'waitlist_text_bounds')) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: a constraint of the new names already exists on public.waitlist. Nothing was changed.';
  END IF;

  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.has_role(uuid, app_role) does not exist: the admin check cannot be written. Nothing was changed.';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: auth.uid() or auth.jwt() is missing. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: anon, authenticated or service_role is missing. Nothing was changed.';
  END IF;
END
$preflight$;

-- What is in place today (for you to read; the apply replaces the policies listed here)
SELECT 'policy' AS kind, policyname AS name, cmd, roles::text AS roles, qual AS using_clause, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist'
UNION ALL
SELECT 'privilege', r.rolname, p.priv, NULL, NULL, NULL
FROM pg_roles r
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
WHERE r.rolname IN ('anon', 'authenticated') AND has_table_privilege(r.rolname, 'public.waitlist', p.priv)
UNION ALL
SELECT 'row_count', 'public.waitlist', count(*)::text, NULL, NULL, NULL FROM public.waitlist
ORDER BY 1, 2, 3;
