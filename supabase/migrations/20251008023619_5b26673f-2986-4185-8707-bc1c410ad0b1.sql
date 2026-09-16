-- Fix security definer view issue
DROP VIEW IF EXISTS public_profiles;

-- Recreate view WITHOUT security definer (default is security invoker which is safe)
CREATE VIEW public_profiles 
WITH (security_invoker = true)
AS
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
  badge,
  level,
  xp,
  created_at,
  verified_metrics,
  professional_skills,
  passion_skills
FROM profiles;

-- Grant public read access to the view
GRANT SELECT ON public_profiles TO anon, authenticated;