DROP VIEW IF EXISTS public.public_profiles_safe;

CREATE VIEW public.public_profiles_safe
WITH (security_invoker=on) AS
SELECT
  user_id,
  full_name,
  username,
  avatar_url,
  role,
  bio,
  location,
  professional_skills,
  badge,
  xp,
  level,
  onboarding_completed,
  account_type,
  instagram_url,
  tiktok_url,
  youtube_url,
  twitter_url,
  linkedin_url,
  id_verified,
  verification_status,
  verification_tier,
  membership_number,
  cover_image_url,
  behance_url,
  imdb_url,
  soundcloud_url,
  spotify_url,
  created_at,
  updated_at
FROM public.profiles
WHERE is_hidden_backer = false;

GRANT SELECT ON public.public_profiles_safe TO anon, authenticated;