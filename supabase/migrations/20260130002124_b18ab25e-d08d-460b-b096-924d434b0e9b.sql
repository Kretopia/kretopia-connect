-- Drop the existing function and recreate with updated return type
DROP FUNCTION IF EXISTS public.find_matching_unclaimed_profiles(text, int);

-- Recreate with all necessary profile fields for claiming
CREATE OR REPLACE FUNCTION public.find_matching_unclaimed_profiles(p_full_name text, p_limit int DEFAULT 5)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  role text,
  bio text,
  avatar_url text,
  location text,
  imported_from_url text,
  imported_data jsonb,
  professional_skills jsonb,
  claim_token text,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.role,
    p.bio,
    p.avatar_url,
    p.location,
    p.imported_from_url,
    p.imported_data,
    p.professional_skills,
    p.claim_token,
    similarity(LOWER(p.full_name), LOWER(p_full_name))::float as similarity_score
  FROM profiles p
  WHERE p.is_claimed = false
    AND p.claim_token IS NOT NULL
    AND similarity(LOWER(p.full_name), LOWER(p_full_name)) > 0.3
  ORDER BY similarity_score DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.find_matching_unclaimed_profiles(text, int) TO authenticated;