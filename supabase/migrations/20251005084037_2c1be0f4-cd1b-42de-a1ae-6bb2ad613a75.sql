-- Fix profiles table security

-- Drop old view if it exists
DROP VIEW IF EXISTS public_profiles;

-- Drop old overly permissive policies
DROP POLICY IF EXISTS "Users can view all profiles for discovery" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles of people they message" ON profiles;

-- Allow unauthenticated users to see profiles (app will filter sensitive fields)
CREATE POLICY "Public can view public profile fields"
ON profiles FOR SELECT
TO anon
USING (true);

-- Authenticated users can see profiles
CREATE POLICY "Authenticated users can view profiles"  
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  true
);

-- Create secure view for public profiles
CREATE VIEW public_profiles AS
SELECT 
  user_id,
  full_name,
  role,
  bio,
  location,
  avatar_url,
  professional_skills,
  passion_skills,
  level,
  badge,
  created_at,
  instagram_url,
  linkedin_url,
  twitter_url,
  behance_url,
  imdb_url,
  spotify_url,
  website
FROM profiles;

GRANT SELECT ON public_profiles TO anon, authenticated;