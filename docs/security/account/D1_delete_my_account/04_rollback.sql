-- LOT D1 -- 04 ROLLBACK. Removes public.delete_my_account(). Nothing else was changed by 02_apply.sql, so nothing else is restored.
-- It does NOT bring back any account that was deleted while the function existed: deletion is permanent.
-- After this the Delete Account button fails again (the app calls the function; the browser cannot use the admin API).
BEGIN;
DROP FUNCTION IF EXISTS public.delete_my_account();
COMMIT;
