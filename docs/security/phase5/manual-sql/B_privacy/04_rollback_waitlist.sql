-- LOT B (waitlist) -- 04 ROLLBACK (targeted). Run it in the SQL Editor of "kretopia-app" only to undo 02_apply_waitlist.sql.
--
-- It removes the two policies and the two bounds this lot created and puts back the last policies and privileges the REPOSITORY knew:
--   INSERT  "Users can submit to waitlist"   (anon, or signed in with their own email)
--   SELECT  "Admins can view waitlist"       (admins)
--   SELECT  "Users can view own waitlist entry"  (a member reads their own entry)
-- plus Supabase's default table privileges for anon and authenticated.
--
-- DOES THIS REINTRODUCE A WEAKNESS? YES, and on purpose of a rollback: after it a visitor can again write every column of their own
-- row (status 'approved', reviewer, AI score and decision, invite code), a signed-in member can read all columns of their own entry
-- (including the AI reasoning and the invite code), and nothing bounds the length of what is sent. The policies it restores are the
-- repository's, which may differ from what production had before lot B: read the result of 01_preflight_waitlist.sql you saved.

BEGIN;

DROP POLICY IF EXISTS waitlist_visitor_insert ON public.waitlist;
DROP POLICY IF EXISTS waitlist_admin_all ON public.waitlist;
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_email_shape;
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_text_bounds;

GRANT ALL ON TABLE public.waitlist TO anon, authenticated, service_role;

CREATE POLICY "Users can submit to waitlist" ON public.waitlist
  FOR INSERT WITH CHECK (auth.uid() IS NULL OR email = (auth.jwt() ->> 'email'));
CREATE POLICY "Admins can view waitlist" ON public.waitlist
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can view own waitlist entry" ON public.waitlist
  FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

COMMIT;

SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist' ORDER BY policyname;
