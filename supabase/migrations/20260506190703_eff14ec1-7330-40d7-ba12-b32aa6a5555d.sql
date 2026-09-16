CREATE OR REPLACE FUNCTION public.find_duplicate_account_candidates(p_user_id UUID)
RETURNS TABLE (
  candidate_user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  match_email_local BOOLEAN,
  match_phone BOOLEAN,
  match_name BOOLEAN,
  overlap_count INTEGER,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  me_email TEXT;
  me_local TEXT;
  me_phone TEXT;
  me_name  TEXT;
BEGIN
  SELECT u.email, p.phone_number, p.full_name
    INTO me_email, me_phone, me_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id;

  IF me_email IS NULL THEN
    RETURN;
  END IF;

  me_local := lower(split_part(me_email, '@', 1));

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.user_id,
      p.full_name,
      p.avatar_url,
      u.email AS cand_email,
      p.phone_number AS cand_phone
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id <> p_user_id
  ),
  scored AS (
    SELECT
      c.user_id AS candidate_user_id,
      c.full_name,
      c.avatar_url,
      (lower(split_part(c.cand_email, '@', 1)) = me_local) AS match_email_local,
      (me_phone IS NOT NULL AND c.cand_phone = me_phone) AS match_phone,
      (me_name IS NOT NULL AND c.full_name IS NOT NULL
        AND similarity(lower(c.full_name), lower(me_name)) >= 0.85) AS match_name_strict,
      (me_name IS NOT NULL AND c.full_name IS NOT NULL
        AND similarity(lower(c.full_name), lower(me_name)) >= 0.7) AS match_name_loose,
      (
        SELECT COUNT(*)::INTEGER FROM public.connections k1
        JOIN public.connections k2
          ON k2.connected_user_id = k1.connected_user_id
         AND k2.user_id = c.user_id
        WHERE k1.user_id = p_user_id
      ) AS overlap_count
    FROM candidates c
  )
  SELECT
    s.candidate_user_id,
    s.full_name,
    s.avatar_url,
    s.match_email_local,
    s.match_phone,
    s.match_name_strict AS match_name,
    s.overlap_count,
    (
      (CASE WHEN s.match_phone THEN 0.9 ELSE 0 END)
      + (CASE WHEN s.match_email_local THEN 0.5 ELSE 0 END)
      + (CASE WHEN s.match_name_strict THEN 0.4 ELSE 0 END)
      + (CASE WHEN s.match_name_loose AND NOT s.match_name_strict THEN 0.15 ELSE 0 END)
      + LEAST(s.overlap_count, 5) * 0.05
    )::NUMERIC AS confidence
  FROM scored s
  -- Tightened: only surface VERY close matches.
  -- Require either: phone match, OR email-local + any name overlap, OR strict name + shared connections.
  WHERE
    s.match_phone
    OR (s.match_email_local AND s.match_name_loose)
    OR (s.match_name_strict AND s.overlap_count >= 2)
  ORDER BY confidence DESC
  LIMIT 3;
END;
$$;