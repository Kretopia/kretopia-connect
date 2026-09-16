CREATE OR REPLACE FUNCTION public.search_my_credits(p_query text DEFAULT '', p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  project_name text,
  role text,
  year int,
  verification_status text,
  credit_category text,
  project_type text,
  platform text,
  client_brand text,
  location text,
  thumbnail_url text,
  primary_media_url text,
  url text,
  endorsement_count int,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q text := btrim(coalesce(p_query, ''));
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF length(v_q) > 120 THEN
    v_q := left(v_q, 120);
  END IF;

  RETURN QUERY
  SELECT c.id, c.project_name, c.role, c.year, c.verification_status,
         c.credit_category, c.project_type, c.platform, c.client_brand,
         c.location, c.thumbnail_url, c.primary_media_url, c.url,
         coalesce(c.endorsement_count, 0), c.created_at
  FROM public.credits c
  WHERE c.user_id = v_uid
    AND (
      v_q = ''
      OR c.project_name ILIKE '%' || v_q || '%'
      OR c.role ILIKE '%' || v_q || '%'
      OR coalesce(c.client_brand, '') ILIKE '%' || v_q || '%'
      OR coalesce(c.platform, '') ILIKE '%' || v_q || '%'
      OR coalesce(c.year::text, '') ILIKE '%' || v_q || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_my_credits(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_my_credits(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_credits_overview()
RETURNS TABLE (
  total_credits int,
  verified_credits int,
  pending_credits int,
  missing_evidence int,
  endorsements_received int,
  last_credit_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE c.verification_status = 'verified')::int,
    count(*) FILTER (WHERE coalesce(c.verification_status, 'pending') <> 'verified')::int,
    count(*) FILTER (WHERE coalesce(c.url, '') = '' AND coalesce(c.primary_media_url, '') = '' AND coalesce(c.verification_url, '') = '')::int,
    coalesce(sum(coalesce(c.endorsement_count, 0)), 0)::int,
    max(c.created_at)
  FROM public.credits c
  WHERE c.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.my_credits_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_credits_overview() TO authenticated;