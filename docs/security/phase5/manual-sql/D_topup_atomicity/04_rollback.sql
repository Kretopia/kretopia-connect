-- LOT D -- one-time consumption of a wallet top-up -- 04 ROLLBACK (targeted). Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It drops the function and the two constraints this lot created; no row and no balance is touched.
--
-- DOES THIS REINTRODUCE A WEAKNESS? Not by itself: nothing called the function while it existed. What it removes are two guarantees
-- (one payment cannot complete two top-ups; a top-up status can only be one of four values). If wallet-topup-confirm has already been
-- changed to call complete_wallet_topup, roll that code change back FIRST, or every top-up confirmation will fail.

BEGIN;

DROP FUNCTION IF EXISTS public.complete_wallet_topup(uuid, uuid, text);
DROP INDEX IF EXISTS public.wallet_topups_gateway_payment_unique;
ALTER TABLE public.wallet_topups DROP CONSTRAINT IF EXISTS wallet_topups_status_known;

COMMIT;

SELECT
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'complete_wallet_topup') AS function_gone,
  to_regclass('public.wallet_topups_gateway_payment_unique') IS NULL AS index_gone;
