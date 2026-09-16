
-- Guest wallet tables
CREATE TABLE public.guest_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  balance_cents integer NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.guest_wallet_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.guest_wallets(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_wallet_sessions_wallet_id ON public.guest_wallet_sessions(wallet_id);

CREATE TABLE public.guest_wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.guest_wallets(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_wallet_topups_wallet_id ON public.guest_wallet_topups(wallet_id);
CREATE INDEX idx_guest_wallet_topups_status ON public.guest_wallet_topups(status);

CREATE TABLE public.guest_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.guest_wallets(id) ON DELETE CASCADE,
  delta_cents integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup','spend','refund','adjustment')),
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_wallet_transactions_wallet_id ON public.guest_wallet_transactions(wallet_id);

-- Lock down with RLS - only service role (edge functions) can access
ALTER TABLE public.guest_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_wallet_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_wallet_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated. Service role bypasses RLS.

-- updated_at trigger reuses existing function
CREATE TRIGGER update_guest_wallets_updated_at
  BEFORE UPDATE ON public.guest_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guest_wallet_topups_updated_at
  BEFORE UPDATE ON public.guest_wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
