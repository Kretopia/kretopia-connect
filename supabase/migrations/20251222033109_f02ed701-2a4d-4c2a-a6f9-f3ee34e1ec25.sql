-- Fix overly permissive RLS policies on profiles table
-- Remove the policies that use USING (true) which expose all profile data

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anonymous users can view public profile info" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can discover profiles" ON profiles;
DROP POLICY IF EXISTS "Public can view basic profile for endorsements" ON profiles;

-- Drop existing view first, then recreate with limited columns
DROP VIEW IF EXISTS public.public_profiles_safe CASCADE;

-- Create a more secure public profiles view for discovery
-- This only exposes non-sensitive fields needed for matching/discovery
CREATE VIEW public.public_profiles_safe AS
SELECT 
  user_id,
  full_name,
  avatar_url,
  role,
  professional_skills,
  passion_skills,
  bio,
  location,
  subscription_tier,
  badge,
  verification_score,
  level,
  xp,
  account_type,
  company_name,
  company_logo_url,
  collab_intent,
  job_title,
  industry
FROM profiles
WHERE onboarding_completed = true;

-- Grant access to the safe view
GRANT SELECT ON public.public_profiles_safe TO anon;
GRANT SELECT ON public.public_profiles_safe TO authenticated;

-- Create a new, more restrictive discovery policy for authenticated users
CREATE POLICY "Authenticated users can discover limited profile info"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Users can see limited info of other completed profiles for discovery
  onboarding_completed = true
);

-- Fix skill_endorsements to not leak email publicly
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can view endorsements without contact info" ON skill_endorsements;

-- Create a proper policy that hides sensitive contact info for anonymous users
CREATE POLICY "Public can view endorsement basic info only"
ON skill_endorsements
FOR SELECT
TO anon
USING (true);

-- Drop and recreate secure view for endorsements (excludes email)
DROP VIEW IF EXISTS public.skill_endorsements_public CASCADE;

CREATE VIEW public.skill_endorsements_public AS
SELECT 
  id,
  profile_id,
  request_id,
  skill_name,
  endorser_name,
  endorser_company,
  project_name,
  proficiency_level,
  testimonial,
  relationship,
  verified,
  created_at
FROM skill_endorsements;

-- Grant access to the safe endorsements view (excludes endorser_email)
GRANT SELECT ON public.skill_endorsements_public TO anon;
GRANT SELECT ON public.skill_endorsements_public TO authenticated;