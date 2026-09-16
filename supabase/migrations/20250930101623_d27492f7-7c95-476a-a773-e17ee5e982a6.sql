-- Add XP and level system to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Create XP activities tracking table
CREATE TABLE IF NOT EXISTS public.xp_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.xp_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for xp_activities
CREATE POLICY "Users can view own xp activities"
ON public.xp_activities FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own xp activities"
ON public.xp_activities FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create invites table
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invitee_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  invitee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for invites
CREATE POLICY "Users can view own invites"
ON public.invites FOR SELECT
USING (auth.uid() = inviter_id OR auth.uid() = invitee_user_id);

CREATE POLICY "Users can create invites"
ON public.invites FOR INSERT
WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update invites they received"
ON public.invites FOR UPDATE
USING (auth.uid() = invitee_user_id);

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION public.calculate_level(xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Level = floor(sqrt(xp / 100)) + 1
  -- This means: Level 1: 0-99 XP, Level 2: 100-399 XP, Level 3: 400-899 XP, etc.
  RETURN FLOOR(SQRT(xp / 100.0)) + 1;
END;
$$;

-- Trigger to auto-update level when XP changes
CREATE OR REPLACE FUNCTION public.update_level_from_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.level = calculate_level(NEW.xp);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_xp_change
BEFORE UPDATE OF xp ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_level_from_xp();