-- LOT D -- one-time consumption of a wallet top-up -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after 01_preflight.sql.
-- One transaction. It adds one function and two constraints; it changes no row and no balance.
--
--   complete_wallet_topup(top-up id, user id, payment id) -> applied, credited_amount, new_balance
--     claims the top-up (row lock, then status pending -> completed) AND credits the wallet in the same transaction. Called twice, the second
--     call answers applied = false and credits nothing. If the credit fails, the claim is rolled back with it: no "paid but never credited".
--   wallet_topups_gateway_payment_unique: one payment id can complete at most one top-up, whatever the code does.
--   wallet_topups_status_known: a top-up is pending, completed, failed or cancelled; nothing else can be written.
--
-- WHAT THIS LOT IS AND IS NOT. The schema part is here. The CODE part is separate and comes after validation (05_CONCURRENCY_TEST.md):
-- wallet-topup-confirm must call complete_wallet_topup instead of its three steps. Until then the function exists and nothing calls it, so
-- applying this lot changes no behaviour today; the two constraints are the only thing in force.

BEGIN;

DO $assert$
BEGIN
  IF to_regclass('public.wallet_topups') IS NULL OR to_regclass('public.wallets') IS NULL
     OR to_regprocedure('public.wallet_credit(uuid, numeric)') IS NULL OR to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: a table or function this lot needs is missing. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'complete_wallet_topup')
     OR to_regclass('public.wallet_topups_gateway_payment_unique') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.wallet_topups'::regclass AND conname = 'wallet_topups_status_known') THEN
    RAISE EXCEPTION 'APPLY STOPPED: an object of this lot already exists. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_topups WHERE gateway_payment_id IS NOT NULL GROUP BY gateway_payment_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'APPLY STOPPED: one payment id is on several top-ups. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_topups WHERE status IS NULL OR status NOT IN ('pending', 'completed', 'failed', 'cancelled')) THEN
    RAISE EXCEPTION 'APPLY STOPPED: a top-up has a status the lot does not allow. Nothing was changed.';
  END IF;
END
$assert$;

CREATE UNIQUE INDEX wallet_topups_gateway_payment_unique
  ON public.wallet_topups (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

ALTER TABLE public.wallet_topups
  ADD CONSTRAINT wallet_topups_status_known CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) NOT VALID;
ALTER TABLE public.wallet_topups VALIDATE CONSTRAINT wallet_topups_status_known;

CREATE FUNCTION public.complete_wallet_topup(p_topup_id uuid, p_user_id uuid, p_gateway_payment_id text)
RETURNS TABLE (applied boolean, credited_amount numeric, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_amount   numeric;
  v_status   text;
  v_currency text;
  v_balance  numeric;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'complete_wallet_topup is for the service role' USING ERRCODE = '42501';
  END IF;
  IF p_topup_id IS NULL OR p_user_id IS NULL OR p_gateway_payment_id IS NULL OR char_length(p_gateway_payment_id) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'invalid top-up completion' USING ERRCODE = '22023';
  END IF;

  -- The row lock serialises every completion of this top-up: the second caller waits here, then sees "completed".
  SELECT t.amount, t.status, t.currency INTO v_amount, v_status, v_currency
  FROM public.wallet_topups t
  WHERE t.id = p_topup_id AND t.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'top-up not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'completed' THEN
    RETURN QUERY SELECT false, v_amount, NULL::numeric;
    RETURN;
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'a % top-up cannot be completed', v_status USING ERRCODE = '55000';
  END IF;
  -- The wallet holds USD only (walletTopup.ts, WALLET_CURRENCY): a top-up in another currency is never credited at face value.
  IF v_currency IS DISTINCT FROM 'USD' THEN
    RAISE EXCEPTION 'top-up currency % is not the wallet currency', v_currency USING ERRCODE = '22023';
  END IF;

  UPDATE public.wallet_topups t
     SET status = 'completed', completed_at = now(), gateway_payment_id = p_gateway_payment_id
   WHERE t.id = p_topup_id;

  -- Same transaction: if this raises, the claim above is rolled back with it.
  v_balance := public.wallet_credit(p_user_id, v_amount);

  RETURN QUERY SELECT true, v_amount, v_balance;
END
$fn$;

REVOKE ALL ON FUNCTION public.complete_wallet_topup(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wallet_topup(uuid, uuid, text) TO service_role;

COMMIT;

SELECT 'applied' AS result, 'now run 03_verify.sql; the code change waits for 05_CONCURRENCY_TEST.md' AS next_step;
