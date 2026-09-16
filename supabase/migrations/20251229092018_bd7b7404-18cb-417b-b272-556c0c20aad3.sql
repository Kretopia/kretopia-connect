-- Add unclaimed profile support to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS profile_source TEXT DEFAULT 'user_created',
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS imported_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS imported_from_url TEXT;

-- Create claim requests table for tracking claim attempts
CREATE TABLE IF NOT EXISTS public.profile_claim_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  claimant_email TEXT NOT NULL,
  claimant_user_id UUID REFERENCES auth.users(id),
  verification_method TEXT NOT NULL, -- 'email', 'social', 'admin'
  verification_proof TEXT, -- URL, code, or notes
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_claim_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for claim requests
CREATE POLICY "Admins can view all claim requests"
  ON public.profile_claim_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update claim requests"
  ON public.profile_claim_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can create claim requests"
  ON public.profile_claim_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own claim requests"
  ON public.profile_claim_requests FOR SELECT
  USING (claimant_user_id = auth.uid() OR claimant_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Function to generate claim token
CREATE OR REPLACE FUNCTION public.generate_claim_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN 'claim_' || SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 16);
END;
$$;

-- Function to create unclaimed profile (for admin use)
CREATE OR REPLACE FUNCTION public.create_unclaimed_profile(
  p_full_name TEXT,
  p_role TEXT,
  p_bio TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_professional_skills JSONB DEFAULT '[]',
  p_imported_data JSONB DEFAULT '{}',
  p_imported_from_url TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'admin_created'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  new_user_id UUID;
  new_claim_token TEXT;
BEGIN
  -- Generate a new UUID for the unclaimed profile
  new_user_id := gen_random_uuid();
  new_claim_token := generate_claim_token();
  
  -- Insert the unclaimed profile
  INSERT INTO public.profiles (
    user_id,
    full_name,
    role,
    bio,
    avatar_url,
    location,
    professional_skills,
    imported_data,
    imported_from_url,
    is_claimed,
    claim_token,
    profile_source,
    onboarding_completed,
    subscription_tier,
    subscription_status
  ) VALUES (
    new_user_id,
    p_full_name,
    p_role,
    p_bio,
    p_avatar_url,
    p_location,
    p_professional_skills,
    p_imported_data,
    p_imported_from_url,
    false,
    new_claim_token,
    p_source,
    true, -- Consider imported profiles as "complete"
    'free',
    'inactive'
  );
  
  RETURN new_user_id;
END;
$$;

-- Function to claim a profile
CREATE OR REPLACE FUNCTION public.claim_profile(
  p_claim_token TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  unclaimed_profile RECORD;
BEGIN
  -- Find the unclaimed profile
  SELECT * INTO unclaimed_profile
  FROM public.profiles
  WHERE claim_token = p_claim_token
    AND is_claimed = false;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Transfer the profile data to the claiming user
  UPDATE public.profiles
  SET 
    full_name = COALESCE(unclaimed_profile.full_name, full_name),
    role = COALESCE(unclaimed_profile.role, role),
    bio = COALESCE(unclaimed_profile.bio, bio),
    avatar_url = COALESCE(unclaimed_profile.avatar_url, avatar_url),
    location = COALESCE(unclaimed_profile.location, location),
    professional_skills = CASE 
      WHEN unclaimed_profile.professional_skills IS NOT NULL AND unclaimed_profile.professional_skills != '[]'::jsonb 
      THEN unclaimed_profile.professional_skills 
      ELSE professional_skills 
    END,
    imported_data = unclaimed_profile.imported_data,
    imported_from_url = unclaimed_profile.imported_from_url
  WHERE user_id = p_user_id;
  
  -- Mark original as claimed and link to new owner
  UPDATE public.profiles
  SET 
    is_claimed = true,
    claimed_at = now(),
    claimed_by = p_user_id
  WHERE user_id = unclaimed_profile.user_id;
  
  RETURN true;
END;
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_claimed ON public.profiles(is_claimed);
CREATE INDEX IF NOT EXISTS idx_profiles_claim_token ON public.profiles(claim_token);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON public.profile_claim_requests(status);

-- Add updated_at trigger
CREATE TRIGGER update_profile_claim_requests_updated_at
  BEFORE UPDATE ON public.profile_claim_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();