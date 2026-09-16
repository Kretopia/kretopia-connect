-- Create matches table to track mutual connections
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('creator', 'opportunity')),
  target_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id, target_id)
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matches
CREATE POLICY "Users can view their own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "System can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Add subscription_tier to profiles for filters
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium'));

-- Add swipe_count tracking for daily limits
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_swipes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_swipe_reset TIMESTAMPTZ DEFAULT now();

-- Function to check and reset daily swipes
CREATE OR REPLACE FUNCTION check_daily_swipes()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset swipes if it's a new day
  IF DATE(NEW.last_swipe_reset) < CURRENT_DATE THEN
    NEW.daily_swipes = 0;
    NEW.last_swipe_reset = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER reset_daily_swipes_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_swipes();