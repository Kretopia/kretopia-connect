-- Drop and recreate public_profiles view with badge column
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
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
  youtube_subscribers,
  instagram_followers,
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
  updated_at,
  badge
FROM public.profiles;