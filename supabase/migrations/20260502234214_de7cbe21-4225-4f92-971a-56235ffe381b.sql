CREATE OR REPLACE FUNCTION public.get_ambassador_referral_stats()
RETURNS TABLE(
  total_signups bigint,
  recent jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _code text;
BEGIN
  SELECT ambassador_code INTO _code
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _code IS NULL THEN
    RETURN QUERY SELECT 0::bigint, '[]'::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles WHERE referred_by_ambassador = _code)::bigint AS total_signups,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'first_name', split_part(coalesce(full_name, 'Member'), ' ', 1),
          'signed_up_at', created_at
        ) ORDER BY created_at DESC)
        FROM (
          SELECT full_name, created_at
          FROM public.profiles
          WHERE referred_by_ambassador = _code
          ORDER BY created_at DESC
          LIMIT 10
        ) recent_signups
      ),
      '[]'::jsonb
    ) AS recent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_referral_stats() TO authenticated;