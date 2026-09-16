-- Recreate the view with SECURITY INVOKER to use the querying user's permissions
CREATE OR REPLACE VIEW public.public_profiles_view 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  full_name,
  role,
  bio,
  avatar_url,
  location,
  job_title,
  industry,
  professional_skills,
  passion_skills,
  website,
  linkedin_url,
  behance_url,
  imdb_url,
  instagram_url,
  twitter_url,
  spotify_url,
  soundcloud_url,
  badge,
  created_at
FROM public.profiles;