-- Drop the existing public_profiles view
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate public_profiles as a security invoker view (uses querying user's permissions)
-- This allows anyone (even unauthenticated users) to view public profile data
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker=true)
AS
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
  twitter_followers,
  linkedin_connections,
  spotify_listeners,
  total_engagement_rate,
  verified_metrics,
  level,
  xp,
  avg_views,
  badge,
  created_at,
  updated_at
FROM public.profiles;

-- Grant select permission to anonymous and authenticated users
GRANT SELECT ON public.public_profiles TO anon, authenticated;