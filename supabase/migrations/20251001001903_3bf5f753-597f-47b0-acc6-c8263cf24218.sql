-- Create a secure view for public profile data that excludes sensitive information
-- This prevents authenticated users from accessing payment, storage, and subscription data
-- even if they query the API directly

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
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
  spotify_url,
  soundcloud_url,
  instagram_followers,
  youtube_subscribers,
  tiktok_followers,
  spotify_listeners,
  twitter_followers,
  linkedin_connections,
  total_engagement_rate,
  avg_views,
  verified_metrics,
  xp,
  level,
  created_at,
  updated_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- Grant select access to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Update RLS policies on profiles table to be more restrictive
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles when authenticated" ON public.profiles;

-- Create a policy that only allows users to view their own full profile
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add comment documenting the security model
COMMENT ON VIEW public.public_profiles IS 'Public view of profiles that excludes sensitive data like payment information, storage usage, and subscription details. Use this view when displaying profiles to other users.';
COMMENT ON TABLE public.profiles IS 'Full profile table including sensitive data. RLS ensures users can only see their own complete profile. Other users should query public_profiles view instead.';