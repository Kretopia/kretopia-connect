-- LOT D1 -- 02 APPLY. SQL Editor of "kretopia-app" only, after 01_preflight.sql. One transaction.
-- Adds public.delete_my_account(): a signed-in member deletes THEIR OWN profile row and login (auth.users row). Deleting the profile
-- cascades to every table whose foreign key to profiles(id) says ON DELETE CASCADE; deleting the login cascades to the tables that
-- reference auth.users with CASCADE. The profile is deleted explicitly because migration 20251229182924 dropped profiles_user_id_fkey
-- (unclaimed profiles), so removing the login alone would leave the profile and its data behind.
-- The browser can't do this itself: auth.admin.deleteUser needs the service-role key and answers 403 not_admin.
-- Changes no table, no policy and no existing function.
--
-- Before deleting, it sets to NULL every NULLABLE column that points at the member with NO ACTION / RESTRICT (reviewed_by, invited_by,
-- claimed_by, resolved_by, ...), read from the catalog so it follows production rather than the repository. A NOT NULL reference
-- (01_preflight.sql lists them) makes the delete fail as a whole: nothing is changed and the member sees "account_delete_blocked".
BEGIN;

DO $assert$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: auth.users is missing. Nothing was changed.';
  END IF;
  IF to_regclass('public.profiles') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
    RAISE EXCEPTION 'APPLY STOPPED: public.profiles(user_id) is missing; this lot assumes it. Nothing was changed.';
  END IF;
  IF NOT has_table_privilege(current_user, 'auth.users', 'DELETE') THEN
    RAISE EXCEPTION 'APPLY STOPPED: % cannot DELETE from auth.users, so the function could not work. Run this as the project owner (postgres). Nothing was changed.', current_user;
  END IF;
END
$assert$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ref record;
  v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Release what would block the delete: nullable columns that reference this member (directly, or through their profile row)
  -- with NO ACTION / RESTRICT. Other members' records stay, only the pointer to the deleted member is dropped.
  FOR v_ref IN
    SELECT c.conrelid::regclass::text AS tbl,
           a.attname                  AS col,
           (c.confrelid = 'auth.users'::regclass) AS to_auth_user,
           pa.attname                 AS parent_col
      FROM pg_constraint c
      JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
     WHERE c.contype = 'f'
       AND cardinality(c.conkey) = 1
       AND c.confdeltype IN ('a', 'r')
       AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
       AND NOT a.attnotnull
  LOOP
    IF v_ref.to_auth_user THEN
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', v_ref.tbl, v_ref.col, v_ref.col) USING v_uid;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I IN (SELECT %I FROM public.profiles WHERE user_id = $1)',
                     v_ref.tbl, v_ref.col, v_ref.col, v_ref.parent_col) USING v_uid;
    END IF;
  END LOOP;

  BEGIN
    DELETE FROM public.profiles WHERE user_id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN foreign_key_violation THEN
    -- A NOT NULL reference (or a table this lot does not know about) still points at the member. Log the detail for the owner,
    -- tell the member only that it was blocked; the whole call, including the NULLing above, is rolled back.
    RAISE LOG 'delete_my_account blocked for %: %', v_uid, SQLERRM;
    RAISE EXCEPTION 'account_delete_blocked' USING ERRCODE = '23503';
  END;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'Deletes the calling member''s own profile (user_id = auth.uid()) and login (auth.users); cascades per foreign keys. Nulls nullable NO ACTION references first. Lot D1.';

COMMIT;
