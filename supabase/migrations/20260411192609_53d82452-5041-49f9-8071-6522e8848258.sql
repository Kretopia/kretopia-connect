-- Create referral network tier enum
CREATE TYPE public.network_tier AS ENUM ('none', 'spark', 'connector', 'socialite', 'networker', 'mogul', 'icon');

-- Create referral network tracking table
CREATE TABLE public.referral_network (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  referral_count INTEGER NOT NULL DEFAULT 0,
  active_referral_count INTEGER NOT NULL DEFAULT 0,
  network_tier public.network_tier NOT NULL DEFAULT 'none',
  total_network_size INTEGER NOT NULL DEFAULT 0,
  free_pro_months_earned INTEGER NOT NULL DEFAULT 0,
  free_pro_months_used INTEGER NOT NULL DEFAULT 0,
  fee_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status_bonus_points INTEGER NOT NULL DEFAULT 0,
  longest_chain INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral chain table (tracks who referred whom, and depth)
CREATE TABLE public.referral_chain (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  depth INTEGER NOT NULL DEFAULT 1,
  chain_root_id UUID,
  referred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT false,
  has_pro_subscription BOOLEAN NOT NULL DEFAULT false
);

-- Create index for chain lookups
CREATE INDEX idx_referral_chain_referrer ON public.referral_chain(referrer_id);
CREATE INDEX idx_referral_chain_root ON public.referral_chain(chain_root_id);

-- Enable RLS
ALTER TABLE public.referral_network ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_chain ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_network
CREATE POLICY "Users can view their own referral network"
  ON public.referral_network FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral network"
  ON public.referral_network FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral network"
  ON public.referral_network FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for referral_chain
CREATE POLICY "Users can view chains they are part of"
  ON public.referral_chain FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can insert referral chains"
  ON public.referral_chain FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- Function to calculate network tier and rewards
CREATE OR REPLACE FUNCTION public.calculate_network_tier(ref_count INTEGER)
RETURNS public.network_tier
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF ref_count >= 100 THEN RETURN 'icon';
  ELSIF ref_count >= 50 THEN RETURN 'mogul';
  ELSIF ref_count >= 30 THEN RETURN 'networker';
  ELSIF ref_count >= 15 THEN RETURN 'socialite';
  ELSIF ref_count >= 5 THEN RETURN 'connector';
  ELSIF ref_count >= 1 THEN RETURN 'spark';
  ELSE RETURN 'none';
  END IF;
END;
$$;

-- Function to calculate rewards based on tier
CREATE OR REPLACE FUNCTION public.update_referral_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tier public.network_tier;
  pro_months INTEGER;
  fee_discount NUMERIC;
  commission NUMERIC;
  bonus_points INTEGER;
BEGIN
  new_tier := calculate_network_tier(NEW.referral_count);
  
  -- Calculate rewards per tier
  CASE new_tier
    WHEN 'spark' THEN
      pro_months := 1; fee_discount := 0; commission := 0; bonus_points := 50;
    WHEN 'connector' THEN
      pro_months := 3; fee_discount := 5; commission := 2; bonus_points := 150;
    WHEN 'socialite' THEN
      pro_months := 6; fee_discount := 10; commission := 3; bonus_points := 400;
    WHEN 'networker' THEN
      pro_months := 12; fee_discount := 15; commission := 5; bonus_points := 800;
    WHEN 'mogul' THEN
      pro_months := 24; fee_discount := 20; commission := 7; bonus_points := 1500;
    WHEN 'icon' THEN
      pro_months := 999; fee_discount := 25; commission := 10; bonus_points := 3000;
    ELSE
      pro_months := 0; fee_discount := 0; commission := 0; bonus_points := 0;
  END CASE;

  NEW.network_tier := new_tier;
  NEW.free_pro_months_earned := pro_months;
  NEW.fee_discount_percent := fee_discount;
  NEW.commission_rate := commission;
  NEW.status_bonus_points := bonus_points;
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-calculate tier on referral count change
CREATE TRIGGER update_referral_tier
  BEFORE UPDATE OF referral_count ON public.referral_network
  FOR EACH ROW
  EXECUTE FUNCTION public.update_referral_rewards();

-- Function to record a referral and update counts
CREATE OR REPLACE FUNCTION public.record_referral(
  p_referrer_id UUID,
  p_referred_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chain_root UUID;
  chain_depth INTEGER;
BEGIN
  -- Find referrer's chain to determine depth
  SELECT chain_root_id, depth INTO chain_root, chain_depth
  FROM referral_chain WHERE referred_id = p_referrer_id;
  
  -- Insert chain record
  INSERT INTO referral_chain (referrer_id, referred_id, depth, chain_root_id)
  VALUES (
    p_referrer_id, 
    p_referred_id, 
    COALESCE(chain_depth, 0) + 1,
    COALESCE(chain_root, p_referrer_id)
  )
  ON CONFLICT (referred_id) DO NOTHING;
  
  -- Upsert referral network for the referrer
  INSERT INTO referral_network (user_id, referral_count)
  VALUES (p_referrer_id, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET referral_count = referral_network.referral_count + 1;
  
  -- Update 2nd-degree network size for chain root
  IF chain_root IS NOT NULL AND chain_root != p_referrer_id THEN
    UPDATE referral_network
    SET total_network_size = total_network_size + 1
    WHERE user_id = chain_root;
  END IF;
  
  -- Update longest chain
  UPDATE referral_network
  SET longest_chain = GREATEST(longest_chain, COALESCE(chain_depth, 0) + 1)
  WHERE user_id = COALESCE(chain_root, p_referrer_id);
END;
$$;