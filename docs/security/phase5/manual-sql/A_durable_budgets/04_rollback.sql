-- LOT A -- durable budgets -- 04 ROLLBACK (targeted). Run it in the SQL Editor of "kretopia-app" only if lot A must be undone.
--
-- It drops exactly what 02_apply.sql created: three functions, two tables (with their indexes and constraints). Nothing else.
--
-- DOES THIS REINTRODUCE A WEAKNESS? No: these objects are new and nothing existing depended on them. But every edge function that
-- reserves a budget through them fails closed once they are gone (it cannot reserve), so the guarded surfaces stop answering until
-- lot A is applied again or the code is rolled back. Roll the edge code back FIRST if it already calls these functions.
--
-- DATA: the tables hold counters and short-lived reservations. If they hold rows, this script refuses to drop them until the
-- line marked CONFIRM below is changed from 'no' to 'yes' by you, on purpose.

BEGIN;

SET LOCAL kretopia.confirm_budget_rollback = 'no';   -- CONFIRM: change to 'yes' to allow dropping tables that hold rows

DO $guard$
DECLARE
  v_rows bigint := 0;
BEGIN
  IF to_regclass('public.budget_buckets') IS NOT NULL AND to_regclass('public.budget_reservations') IS NOT NULL THEN
    EXECUTE 'SELECT (SELECT count(*) FROM public.budget_buckets) + (SELECT count(*) FROM public.budget_reservations)' INTO v_rows;
  END IF;
  IF v_rows > 0 AND coalesce(current_setting('kretopia.confirm_budget_rollback', true), 'no') <> 'yes' THEN
    RAISE EXCEPTION 'ROLLBACK STOPPED: the budget tables hold % row(s). Set kretopia.confirm_budget_rollback to yes (line marked CONFIRM) if you really want them dropped. Nothing was changed.', v_rows;
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.reserve_budget(text, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.commit_budget(uuid);
DROP FUNCTION IF EXISTS public.release_budget(uuid);
DROP TABLE IF EXISTS public.budget_reservations;
DROP TABLE IF EXISTS public.budget_buckets;

COMMIT;

SELECT
  to_regclass('public.budget_buckets') IS NULL AND to_regclass('public.budget_reservations') IS NULL AS tables_gone,
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('reserve_budget', 'commit_budget', 'release_budget')) AS functions_gone;
