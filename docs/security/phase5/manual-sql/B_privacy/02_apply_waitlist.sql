-- LOT B (waitlist) -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after 01_preflight_waitlist.sql returned its rows.
-- One transaction. It replaces the policies and the privileges of public.waitlist by the contract below; it deletes no row.
--
--   VISITOR (anon, or signed in): may INSERT, and only these 11 columns:
--       email, full_name, role, instagram_url, twitter_url, linkedin_url, spotify_url, website, bio, why_join, status
--     with status limited to 'pending' or 'review', and -- when signed in -- their own email. The review state (reviewer, AI score,
--     AI decision, AI reasoning, invite code, invite date) cannot be written by a visitor at all (no column privilege), and the
--     policy refuses it too if it ever were granted by mistake.
--   NOBODY but an admin reads, updates or deletes (policy waitlist_admin_all); a visitor reads nothing, not even their own entry.
--   SERVICE ROLE: full access, as before (validate-waitlist-ai writes the review state with it).
--
-- Residual, stated: inserting an email that is already on the list fails with a "duplicate key" error, which tells a visitor that the
-- address is already there. Closing that needs the insert to go through a function; it is not part of this lot.

BEGIN;

DO $assert$
DECLARE
  v_known_policies text[] := ARRAY[
    'Anyone can submit to waitlist', 'Authenticated users can submit to waitlist', 'Users can submit to waitlist',
    'Users can view their own waitlist entry', 'Only user and admins view waitlist entries', 'Users can view own waitlist entry',
    'Admins can view all waitlist entries', 'Anyone can view waitlist', 'Waitlist is viewable by admins',
    'Only admins can view waitlist', 'Admins can view waitlist'];
  v_unknown text;
BEGIN
  IF to_regclass('public.waitlist') IS NULL OR NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.waitlist'::regclass) THEN
    RAISE EXCEPTION 'APPLY STOPPED: public.waitlist is missing or has RLS off. Nothing was changed.';
  END IF;
  SELECT string_agg(policyname, ', ') INTO v_unknown FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'waitlist' AND NOT (policyname = ANY (v_known_policies));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: unknown policy(ies) on public.waitlist: %. Nothing was changed.', v_unknown;
  END IF;
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: public.has_role(uuid, app_role) is missing. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist' AND policyname IN ('waitlist_visitor_insert', 'waitlist_admin_all')) THEN
    RAISE EXCEPTION 'APPLY STOPPED: a policy of the new names already exists. Nothing was changed.';
  END IF;
END
$assert$;

-- 1. Remove the known policies (only those that exist; the assertion above guarantees there is nothing else).
DO $drop$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist' LOOP
    EXECUTE format('DROP POLICY %I ON public.waitlist', p.policyname);
  END LOOP;
END
$drop$;

-- 2. Privileges: nothing for anyone, then exactly what the contract needs.
REVOKE ALL ON TABLE public.waitlist FROM PUBLIC, anon, authenticated;
GRANT INSERT (email, full_name, role, instagram_url, twitter_url, linkedin_url, spotify_url, website, bio, why_join, status)
  ON TABLE public.waitlist TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.waitlist TO authenticated;   -- reachable only through waitlist_admin_all below
GRANT ALL ON TABLE public.waitlist TO service_role;

-- 3. Policies
CREATE POLICY waitlist_visitor_insert ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL OR email = (auth.jwt() ->> 'email'))
    AND status IN ('pending', 'review')
    AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND ai_score IS NULL AND ai_decision IS NULL AND ai_reasoning IS NULL
    AND invite_code IS NULL AND invite_sent_at IS NULL
  );

CREATE POLICY waitlist_admin_all ON public.waitlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Bounds on what a visitor can send. NOT VALID: they apply to every new or changed row and do not scan or reject what is
--    already stored; 03_verify.sql reports whether the stored rows comply too.
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_email_shape
  CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@<>"]+@[^[:space:]@<>"]+\.[^[:space:]@<>"]+$') NOT VALID;

ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_text_bounds
  CHECK (
    char_length(full_name) <= 200 AND char_length(role) <= 120
    AND coalesce(char_length(bio), 0) <= 4000 AND coalesce(char_length(why_join), 0) <= 4000
    AND coalesce(char_length(website), 0) <= 500
    AND coalesce(char_length(instagram_url), 0) <= 500 AND coalesce(char_length(twitter_url), 0) <= 500
    AND coalesce(char_length(linkedin_url), 0) <= 500 AND coalesce(char_length(spotify_url), 0) <= 500
  ) NOT VALID;

COMMIT;

SELECT 'applied' AS result, 'now run 03_verify_waitlist.sql, then the REST calls at its end' AS next_step;
