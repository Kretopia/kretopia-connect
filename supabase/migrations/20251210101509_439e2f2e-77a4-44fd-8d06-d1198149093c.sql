-- Add enhanced verification columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verified_credentials JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verification_tier TEXT CHECK (verification_tier IN ('verified', 'industry', 'elite')),
ADD COLUMN IF NOT EXISTS achievement_badges TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for verification tier queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_tier ON public.profiles(verification_tier);

-- Create index for achievement badges search
CREATE INDEX IF NOT EXISTS idx_profiles_achievement_badges ON public.profiles USING GIN(achievement_badges);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.verified_credentials IS 'JSON array of verified credentials from AI verification (IMDB, Spotify, awards, etc)';
COMMENT ON COLUMN public.profiles.verification_tier IS 'Verification tier: verified (basic), industry (IMDB/credits), elite (major awards)';
COMMENT ON COLUMN public.profiles.achievement_badges IS 'Array of achievement badge strings like Grammy Winner, IMDB Credited, etc';