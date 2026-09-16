
-- ============ creator_wallets ============
CREATE TABLE public.creator_wallets (
  user_id UUID PRIMARY KEY,
  stripe_account_id TEXT UNIQUE,
  kyc_status TEXT NOT NULL DEFAULT 'none', -- none|pending|verified|restricted
  country TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.creator_wallets TO authenticated;
GRANT ALL ON public.creator_wallets TO service_role;
ALTER TABLE public.creator_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet read" ON public.creator_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own wallet upsert" ON public.creator_wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wallet update" ON public.creator_wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ creator_wallet_balances ============
CREATE TABLE public.creator_wallet_balances (
  user_id UUID NOT NULL,
  currency TEXT NOT NULL,
  available_cents BIGINT NOT NULL DEFAULT 0,
  pending_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, currency)
);
GRANT SELECT ON public.creator_wallet_balances TO authenticated;
GRANT ALL ON public.creator_wallet_balances TO service_role;
ALTER TABLE public.creator_wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own balance read" ON public.creator_wallet_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ creator_payout_methods ============
CREATE TABLE public.creator_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_external_account_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- bank_account | card
  last4 TEXT,
  brand TEXT,        -- bank name or card brand
  currency TEXT NOT NULL,
  country TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payout_methods_user ON public.creator_payout_methods(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_payout_methods TO authenticated;
GRANT ALL ON public.creator_payout_methods TO service_role;
ALTER TABLE public.creator_payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own methods read" ON public.creator_payout_methods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own methods write" ON public.creator_payout_methods FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ creator_payouts ============
CREATE TABLE public.creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_payout_id TEXT UNIQUE,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|in_transit|paid|failed|canceled
  arrival_date TIMESTAMPTZ,
  failure_reason TEXT,
  payout_method_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_user_created ON public.creator_payouts(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.creator_payouts TO authenticated;
GRANT ALL ON public.creator_payouts TO service_role;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payouts read" ON public.creator_payouts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ stripe_webhook_events (idempotency) ============
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

CREATE TRIGGER trg_creator_wallets_updated BEFORE UPDATE ON public.creator_wallets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_creator_payouts_updated BEFORE UPDATE ON public.creator_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ auto-create wallet on profile insert ============
CREATE OR REPLACE FUNCTION public.ensure_creator_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creator_wallets (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_profile_wallet ON public.profiles;
CREATE TRIGGER trg_profile_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_creator_wallet();

-- ============ backfill from existing profiles.stripe_account_id ============
INSERT INTO public.creator_wallets (user_id, stripe_account_id, kyc_status, payouts_enabled, charges_enabled)
SELECT user_id, stripe_account_id,
       CASE WHEN stripe_account_status = 'active' THEN 'verified' ELSE 'pending' END,
       (stripe_account_status = 'active'),
       (stripe_account_status = 'active')
FROM public.profiles
WHERE stripe_account_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET stripe_account_id = EXCLUDED.stripe_account_id,
    kyc_status = EXCLUDED.kyc_status,
    payouts_enabled = EXCLUDED.payouts_enabled,
    charges_enabled = EXCLUDED.charges_enabled;

-- Seed wallets for the rest
INSERT INTO public.creator_wallets (user_id)
SELECT user_id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
