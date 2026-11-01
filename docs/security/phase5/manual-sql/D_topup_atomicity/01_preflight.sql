-- LOT D -- one-time consumption of a wallet top-up -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- Today wallet-topup-confirm does three separate things: (1) claims the top-up by an UPDATE on its status, (2) calls wallet_credit, (3) on a
-- failure of (2) puts the status back. The claim is already compare-and-set, so a top-up is never credited TWICE; but a crash between
-- (1) and (2) leaves a PAID top-up marked completed and never credited, and the revert in (3) can itself fail. This lot moves (1) and (2)
-- into ONE database transaction (complete_wallet_topup) so either both happen or neither does, and adds two constraints that make the
-- invariants hold even if the code is wrong.
--
-- It stops with an error if the data already breaks the constraints it is about to add (it lists what), if something it needs is missing,
-- or if a name it creates is taken. Otherwise it returns its findings.

DO $pre$
DECLARE
  v_bad text;
BEGIN
  IF to_regclass('public.wallet_topups') IS NULL OR to_regclass('public.wallets') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.wallet_topups or public.wallets is missing. Nothing was changed.';
  END IF;
  IF to_regprocedure('public.wallet_credit(uuid, numeric)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.wallet_credit(uuid, numeric) is missing; the lot calls it. Nothing was changed.';
  END IF;
  IF to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: auth.role() is missing. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: anon, authenticated or service_role is missing. Nothing was changed.';
  END IF;

  -- The columns the function reads and writes must be the ones the repository describes.
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(ARRAY['id', 'user_id', 'amount', 'currency', 'status', 'gateway_session_id', 'gateway_payment_id', 'completed_at']) x
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wallet_topups' AND column_name = x);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'PREFLIGHT FAILED: wallet_topups lacks column(s) %. Nothing was changed.', v_bad; END IF;

  -- The wallet must already refuse a negative balance and negative credits at the schema level.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.wallets'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ~* 'balance\s*>=\s*\(*0') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.wallets has no CHECK (balance >= 0). Decide that separately; this lot assumes it. Nothing was changed.';
  END IF;

  -- Names
  IF to_regprocedure('public.complete_wallet_topup(uuid, uuid, text)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'complete_wallet_topup') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: a function named complete_wallet_topup already exists. Nothing was changed.';
  END IF;
  IF to_regclass('public.wallet_topups_gateway_payment_unique') IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: index wallet_topups_gateway_payment_unique already exists. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.wallet_topups'::regclass AND conname = 'wallet_topups_status_known') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: constraint wallet_topups_status_known already exists. Nothing was changed.';
  END IF;

  -- The data must already satisfy what the lot adds.
  SELECT string_agg(format('%s (x%s)', gateway_payment_id, n), ', ') INTO v_bad
  FROM (SELECT gateway_payment_id, count(*) AS n FROM public.wallet_topups WHERE gateway_payment_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the same gateway_payment_id is on several top-ups: %. One payment credited more than one top-up: investigate the wallet balances of those users before anything else. Nothing was changed.', v_bad;
  END IF;

  SELECT string_agg(DISTINCT coalesce(status, '<null>'), ', ') INTO v_bad FROM public.wallet_topups
  WHERE status IS NULL OR status NOT IN ('pending', 'completed', 'failed', 'cancelled');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: wallet_topups holds status value(s) the lot does not allow: %. Decide what they mean, then extend the list in 02_apply.sql. Nothing was changed.', v_bad;
  END IF;
END
$pre$;

SELECT
  (SELECT count(*) FROM public.wallet_topups)                                           AS topups,
  (SELECT count(*) FROM public.wallet_topups WHERE status = 'pending')                  AS pending_topups,
  (SELECT count(*) FROM public.wallet_topups WHERE status = 'completed' AND gateway_payment_id IS NULL) AS completed_without_a_payment_id,
  (SELECT count(*) FROM public.wallet_topups WHERE currency <> 'USD')                   AS topups_in_a_currency_other_than_usd,
  (SELECT count(*) FROM public.wallets WHERE balance < 0)                               AS wallets_with_a_negative_balance,
  'completed_without_a_payment_id counts top-ups completed by older code; the lot does not touch them' AS note;
