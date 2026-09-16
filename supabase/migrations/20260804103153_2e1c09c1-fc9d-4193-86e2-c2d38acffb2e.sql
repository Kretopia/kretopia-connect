-- 1) Prevent clients from fabricating wallet_transfers rows
DROP POLICY IF EXISTS "Users can create transfers they send" ON public.wallet_transfers;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transfers FROM authenticated, anon;
GRANT SELECT ON public.wallet_transfers TO authenticated;
GRANT ALL ON public.wallet_transfers TO service_role;

-- 2) Only expose recipient bank details after a transfer actually completed
DROP POLICY IF EXISTS "Senders view recipient bank for their transfers" ON public.recipient_bank_accounts;
CREATE POLICY "Senders view recipient bank after completed transfer"
ON public.recipient_bank_accounts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.wallet_transfers wt
    WHERE wt.sender_id = auth.uid()
      AND wt.recipient_id = recipient_bank_accounts.user_id
      AND wt.status = 'completed'
  )
);

-- 3) Explicitly block sensitive profile columns from other members (incl. connections)
REVOKE SELECT (
  phone_number, date_of_birth, stripe_customer_id, stripe_subscription_id,
  stripe_account_id, payment_verified, hourly_rate, project_rate
) ON public.profiles FROM authenticated, anon;

-- 4) Atomic wallet balance mutations
CREATE OR REPLACE FUNCTION public.wallet_debit(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  UPDATE public.wallets
     SET balance = balance - p_amount, updated_at = now()
   WHERE user_id = p_user_id AND balance >= p_amount
   RETURNING balance INTO v_balance;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_credit(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  INSERT INTO public.wallets (user_id, balance, credits)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
     SET balance = balance + p_amount, updated_at = now()
   WHERE user_id = p_user_id
   RETURNING balance INTO v_balance;
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_debit(uuid, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_credit(uuid, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_debit(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid, numeric) TO service_role;

-- 5) Idempotent top-up completion: only one completion per topup row
CREATE UNIQUE INDEX IF NOT EXISTS wallet_topups_gateway_session_unique
  ON public.wallet_topups (gateway_session_id)
  WHERE gateway_session_id IS NOT NULL;