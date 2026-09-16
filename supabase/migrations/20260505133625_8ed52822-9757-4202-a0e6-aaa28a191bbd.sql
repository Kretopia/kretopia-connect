CREATE OR REPLACE FUNCTION public.get_or_create_guest_token_for_invite(
  _project_id uuid,
  _email text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_owner uuid;
  v_token text;
  v_email text := lower(trim(_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  -- Only mint a token if there's an actual pending invite for this email on this project
  SELECT p.created_by INTO v_invite_owner
  FROM public.project_collaborators pc
  JOIN public.projects p ON p.id = pc.project_id
  WHERE pc.project_id = _project_id
    AND lower(pc.email) = v_email
    AND pc.status = 'pending'
  LIMIT 1;

  IF v_invite_owner IS NULL THEN
    RETURN NULL;
  END IF;

  -- Reuse an existing live token for this email if one exists
  SELECT token INTO v_token
  FROM public.guest_studio_tokens
  WHERE project_id = _project_id
    AND lower(guest_email) = v_email
    AND revoked_at IS NULL
  LIMIT 1;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  -- Mint a new one
  INSERT INTO public.guest_studio_tokens (project_id, created_by, guest_email, label)
  VALUES (_project_id, v_invite_owner, v_email, 'Email invite preview')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_token_for_invite(uuid, text) TO anon, authenticated;
