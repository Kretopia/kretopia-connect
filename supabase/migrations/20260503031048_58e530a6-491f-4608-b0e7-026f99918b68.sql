CREATE OR REPLACE FUNCTION public.get_credit_endorsement_by_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  credit_id UUID,
  status TEXT,
  relationship TEXT,
  endorser_name TEXT,
  requested_at TIMESTAMPTZ,
  project_name TEXT,
  role TEXT,
  year INTEGER,
  requested_by UUID,
  requester_name TEXT,
  requester_avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ce.id,
    ce.credit_id,
    ce.status,
    ce.relationship,
    ce.endorser_name,
    ce.requested_at,
    c.project_name,
    c.role,
    c.year,
    ce.requested_by,
    p.full_name AS requester_name,
    p.avatar_url AS requester_avatar_url
  FROM public.credit_endorsements ce
  JOIN public.credits c ON c.id = ce.credit_id
  LEFT JOIN public.profiles p ON p.user_id = ce.requested_by
  WHERE ce.token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_credit_endorsement_by_token(
  _token TEXT,
  _accepted BOOLEAN,
  _endorser_name TEXT DEFAULT NULL,
  _relationship TEXT DEFAULT NULL,
  _testimonial TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _endorsement RECORD;
  _new_count INTEGER;
BEGIN
  SELECT ce.id, ce.credit_id, ce.status
  INTO _endorsement
  FROM public.credit_endorsements ce
  WHERE ce.token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification link not found');
  END IF;

  IF _endorsement.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This request has already been answered', 'status', _endorsement.status);
  END IF;

  UPDATE public.credit_endorsements
  SET
    status = CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
    endorser_name = COALESCE(NULLIF(_endorser_name, ''), endorser_name),
    relationship = COALESCE(NULLIF(_relationship, ''), relationship),
    testimonial = CASE WHEN _accepted THEN NULLIF(_testimonial, '') ELSE NULL END,
    responded_at = now()
  WHERE id = _endorsement.id;

  IF _accepted THEN
    UPDATE public.credits
    SET
      endorsement_count = COALESCE(endorsement_count, 0) + 1,
      verification_status = CASE
        WHEN COALESCE(endorsement_count, 0) + 1 >= 2 THEN 'verified'
        ELSE 'peer'
      END
    WHERE id = _endorsement.credit_id
    RETURNING endorsement_count INTO _new_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
    'endorsement_count', COALESCE(_new_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_endorsement_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_credit_endorsement_by_token(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated;