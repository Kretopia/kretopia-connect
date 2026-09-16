CREATE OR REPLACE FUNCTION public.get_public_creator_showcase(
  _viewer_id uuid DEFAULT NULL,
  _limit integer DEFAULT 60
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  role text,
  verification_tier text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.role,
    p.verification_tier,
    p.created_at
  FROM public.profiles p
  WHERE p.is_hidden_backer = false
    AND p.onboarding_completed = true
    AND p.full_name IS NOT NULL
    AND btrim(p.full_name) <> ''
    AND p.avatar_url IS NOT NULL
    AND btrim(p.avatar_url) <> ''
    AND COALESCE(p.account_type, 'individual') <> 'company'
    AND (_viewer_id IS NULL OR p.user_id <> _viewer_id)
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_public_creator_showcase(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_creator_showcase(uuid, integer) TO anon, authenticated;