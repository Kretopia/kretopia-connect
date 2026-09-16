-- Create a minimal view for feed profile display that doesn't filter by onboarding
CREATE OR REPLACE VIEW public.feed_profiles AS
SELECT 
  user_id,
  full_name,
  avatar_url,
  role
FROM profiles;

-- Grant access
GRANT SELECT ON public.feed_profiles TO authenticated;
GRANT SELECT ON public.feed_profiles TO anon;