-- LOT C -- verification badge -- 04 ROLLBACK (targeted). Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It gives signed-in members UPDATE and INSERT on every column of public.profiles again (Supabase's default table privileges), and
-- nothing else.
--
-- DOES THIS REINTRODUCE A WEAKNESS? YES, exactly the one lot C closes: any signed-in member can again set their own
-- verification_status, id_verified, badge, subscription_tier, xp, phone_verified, and store a phone code of their own choosing. Use it
-- only if a locked column turned out to be written by a feature of the app, and fix that feature (route it through a function)
-- rather than staying rolled back.

BEGIN;

GRANT UPDATE, INSERT ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

COMMIT;

SELECT has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS members_have_table_level_update_again;
