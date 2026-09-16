-- Drop the restrictive check constraint that doesn't allow NULL
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_verification_tier_check;

-- Add a new check constraint that allows NULL or valid tier values
ALTER TABLE profiles ADD CONSTRAINT profiles_verification_tier_check 
  CHECK (verification_tier IS NULL OR verification_tier IN ('verified', 'industry', 'elite'));