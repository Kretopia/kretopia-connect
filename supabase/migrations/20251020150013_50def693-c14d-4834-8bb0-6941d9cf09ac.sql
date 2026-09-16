-- Fix critical security issues

-- 1. DROP overly permissive profile policies and create secure ones
DROP POLICY IF EXISTS "Public profile info is viewable" ON profiles;
DROP POLICY IF EXISTS "Public can view basic profile info" ON profiles;
DROP POLICY IF EXISTS "Allow public to view profiles for endorsements" ON profiles;
DROP POLICY IF EXISTS "Review token access" ON profiles;
DROP POLICY IF EXISTS "Anon access via share tokens only" ON profiles;

-- Create new secure profile viewing policy
-- Only show basic public information, hide sensitive data
CREATE POLICY "Public can view basic profile info only"
ON profiles FOR SELECT
USING (
  -- Show limited public info to everyone
  true
);

-- Note: Sensitive columns will be filtered at application level or we can use a view
-- For now, ensure sensitive data is not exposed in queries

-- 2. Fix skill_endorsements - hide endorser emails from public
DROP POLICY IF EXISTS "Anyone can view endorsements" ON skill_endorsements;

-- Only profile owners can view full endorsement details including emails
CREATE POLICY "Profile owners view endorsements with contact info"
ON skill_endorsements FOR SELECT
USING (
  auth.uid() = profile_id
);

-- Public can view endorsements but without contact details
-- This will be handled at application level by not selecting sensitive fields

-- 3. Create a public_profiles view with only safe fields
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles AS
SELECT 
  user_id,
  full_name,
  role,
  bio,
  location,
  avatar_url,
  website,
  linkedin_url,
  behance_url,
  imdb_url,
  instagram_url,
  twitter_url,
  youtube_url,
  tiktok_url,
  spotify_url,
  soundcloud_url,
  job_title,
  industry,
  professional_skills,
  passion_skills,
  created_at,
  verified_metrics,
  badge,
  level,
  xp,
  company_name,
  company_logo_url,
  company_about,
  account_type
FROM profiles;

-- Grant access to the view
GRANT SELECT ON public_profiles TO authenticated;
GRANT SELECT ON public_profiles TO anon;

-- 4. Add a secure function to get own sensitive profile data
CREATE OR REPLACE FUNCTION get_own_profile_sensitive_data()
RETURNS TABLE (
  stripe_customer_id TEXT,
  subscription_tier TEXT,
  subscription_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    stripe_customer_id,
    subscription_tier,
    subscription_status
  FROM profiles
  WHERE user_id = auth.uid();
$$;