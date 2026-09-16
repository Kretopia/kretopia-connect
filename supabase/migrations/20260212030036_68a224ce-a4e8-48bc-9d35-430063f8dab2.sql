
-- Wallet connections table for blockchain integration
CREATE TABLE public.wallet_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_type TEXT NOT NULL DEFAULT 'external', -- 'external' (MetaMask/WC) or 'embedded' (email-based)
  chain_id INTEGER NOT NULL DEFAULT 8453, -- Base mainnet
  is_primary BOOLEAN NOT NULL DEFAULT false,
  label TEXT, -- user-friendly label like "My MetaMask"
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_address)
);

-- Enable RLS
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallets
CREATE POLICY "Users can view own wallets"
  ON public.wallet_connections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can connect wallets
CREATE POLICY "Users can connect wallets"
  ON public.wallet_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own wallets
CREATE POLICY "Users can update own wallets"
  ON public.wallet_connections FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can disconnect wallets
CREATE POLICY "Users can disconnect own wallets"
  ON public.wallet_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Public view of wallet addresses (for verification badges)
CREATE POLICY "Anyone can view wallet addresses for profiles"
  ON public.wallet_connections FOR SELECT
  USING (true);

-- Timestamp trigger
CREATE TRIGGER update_wallet_connections_updated_at
  BEFORE UPDATE ON public.wallet_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups
CREATE INDEX idx_wallet_connections_user_id ON public.wallet_connections(user_id);
CREATE INDEX idx_wallet_connections_address ON public.wallet_connections(wallet_address);
