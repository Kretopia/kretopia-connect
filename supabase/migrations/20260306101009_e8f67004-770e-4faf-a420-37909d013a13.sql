
-- Wallet transfers table for peer-to-peer payments
CREATE TABLE public.wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transfers_positive_amount CHECK (amount > 0),
  CONSTRAINT wallet_transfers_different_users CHECK (sender_id != recipient_id)
);

-- Wallet top-ups table to track funding sources
CREATE TABLE public.wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_gateway TEXT NOT NULL DEFAULT 'stripe',
  gateway_session_id TEXT,
  gateway_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT wallet_topups_positive_amount CHECK (amount > 0)
);

-- Transfer limits config
CREATE TABLE public.wallet_transfer_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,
  daily_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 150,
  monthly_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 750,
  per_transaction_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 750,
  daily_limit_ttd NUMERIC(12,2) NOT NULL DEFAULT 1000,
  monthly_limit_ttd NUMERIC(12,2) NOT NULL DEFAULT 5000,
  per_transaction_limit_ttd NUMERIC(12,2) NOT NULL DEFAULT 5000
);

-- Insert default limits
INSERT INTO public.wallet_transfer_limits (tier, daily_limit_usd, monthly_limit_usd, per_transaction_limit_usd, daily_limit_ttd, monthly_limit_ttd, per_transaction_limit_ttd) VALUES
  ('free', 150, 750, 150, 1000, 5000, 1000),
  ('pro', 1500, 7500, 1500, 10000, 50000, 10000),
  ('enterprise', 7500, 30000, 7500, 50000, 200000, 50000),
  ('founder', 7500, 30000, 7500, 50000, 200000, 50000);

-- Add currency support to wallets table
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

-- Enable RLS
ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transfer_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for wallet_transfers
CREATE POLICY "Users can view their own transfers" ON public.wallet_transfers
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can create transfers they send" ON public.wallet_transfers
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- RLS policies for wallet_topups
CREATE POLICY "Users can view their own topups" ON public.wallet_topups
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own topups" ON public.wallet_topups
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS for transfer limits (public read)
CREATE POLICY "Anyone can read transfer limits" ON public.wallet_transfer_limits
  FOR SELECT TO authenticated
  USING (true);

-- Function to check transfer limits
CREATE OR REPLACE FUNCTION public.check_transfer_limit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_tier TEXT;
  limits RECORD;
  daily_spent NUMERIC;
  monthly_spent NUMERIC;
  daily_limit NUMERIC;
  monthly_limit NUMERIC;
  per_tx_limit NUMERIC;
BEGIN
  -- Get user tier
  SELECT subscription_tier INTO user_tier FROM profiles WHERE user_id = p_user_id;
  user_tier := COALESCE(user_tier, 'free');

  -- Get limits for tier
  SELECT * INTO limits FROM wallet_transfer_limits WHERE tier = user_tier;
  IF NOT FOUND THEN
    SELECT * INTO limits FROM wallet_transfer_limits WHERE tier = 'free';
  END IF;

  -- Set limits based on currency
  IF UPPER(p_currency) = 'TTD' THEN
    daily_limit := limits.daily_limit_ttd;
    monthly_limit := limits.monthly_limit_ttd;
    per_tx_limit := limits.per_transaction_limit_ttd;
  ELSE
    daily_limit := limits.daily_limit_usd;
    monthly_limit := limits.monthly_limit_usd;
    per_tx_limit := limits.per_transaction_limit_usd;
  END IF;

  -- Calculate daily spent
  SELECT COALESCE(SUM(amount), 0) INTO daily_spent
  FROM wallet_transfers
  WHERE sender_id = p_user_id
    AND currency = UPPER(p_currency)
    AND created_at >= CURRENT_DATE;

  -- Calculate monthly spent
  SELECT COALESCE(SUM(amount), 0) INTO monthly_spent
  FROM wallet_transfers
  WHERE sender_id = p_user_id
    AND currency = UPPER(p_currency)
    AND created_at >= date_trunc('month', CURRENT_DATE);

  -- Check limits
  IF p_amount > per_tx_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Exceeds per-transaction limit of ' || per_tx_limit || ' ' || UPPER(p_currency));
  END IF;

  IF (daily_spent + p_amount) > daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Exceeds daily limit of ' || daily_limit || ' ' || UPPER(p_currency) || '. Spent today: ' || daily_spent);
  END IF;

  IF (monthly_spent + p_amount) > monthly_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Exceeds monthly limit of ' || monthly_limit || ' ' || UPPER(p_currency) || '. Spent this month: ' || monthly_spent);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'daily_remaining', daily_limit - daily_spent - p_amount, 'monthly_remaining', monthly_limit - monthly_spent - p_amount);
END;
$$;
