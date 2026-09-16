-- ============================================
-- CREATE SECURE PUBLIC PROFILE VIEW
-- This view exposes only safe, public profile information
-- ============================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Create a view for public profile access (non-sensitive data only)
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
  job_title,
  industry,
  badge,
  level,
  xp,
  -- Social stats (public metrics)
  youtube_subscribers,
  instagram_followers,
  tiktok_followers,
  spotify_listeners,
  twitter_followers,
  linkedin_connections,
  avg_views,
  total_engagement_rate,
  verified_metrics,
  -- Public arrays/JSON
  professional_skills,
  passion_skills,
  press_links,
  awards,
  section_order,
  -- Timestamps
  created_at,
  updated_at
FROM public.profiles;

-- Grant public access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Add helpful comment
COMMENT ON VIEW public.public_profiles IS 'Public-safe view of user profiles. Excludes sensitive fields like Stripe IDs, subscription details, storage limits, membership numbers, and tokens.';