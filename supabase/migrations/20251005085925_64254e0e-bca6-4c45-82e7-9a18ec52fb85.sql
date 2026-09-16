-- Drop the policy that exposes all profiles to authenticated users
DROP POLICY IF EXISTS "Auth users discover profiles" ON public.profiles;

-- Create a secure view for profile discovery that only shows non-sensitive fields
CREATE OR REPLACE VIEW public.public_profiles_view AS
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

-- Grant access to the view
GRANT SELECT ON public.public_profiles_view TO authenticated;
GRANT SELECT ON public.public_profiles_view TO anon;

-- Add comment
COMMENT ON VIEW public.public_profiles_view IS 'Safe view of profiles for discovery - excludes sensitive payment, subscription, and internal data';
