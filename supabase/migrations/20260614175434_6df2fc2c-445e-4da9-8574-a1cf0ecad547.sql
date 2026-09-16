CREATE OR REPLACE FUNCTION public.get_sitemap_profiles()
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  role text,
  bio text,
  avatar_url text,
  location text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.full_name, p.role, p.bio, p.avatar_url, p.location, p.updated_at
  FROM public.profiles p
  WHERE p.onboarding_completed = true
    AND p.full_name IS NOT NULL
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 5000
$$;

GRANT EXECUTE ON FUNCTION public.get_sitemap_profiles() TO anon, authenticated, service_role;