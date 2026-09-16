CREATE OR REPLACE FUNCTION public.promote_guest_token_to_collaborator(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_tok record;
  v_existing uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT project_id, lower(guest_email) AS guest_email, revoked_at, created_by
    INTO v_tok
    FROM public.guest_studio_tokens
    WHERE token = _token;

  IF v_tok IS NULL OR v_tok.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Only auto-promote when the token was minted for this user's email
  IF v_tok.guest_email IS NULL OR v_tok.guest_email <> v_user_email THEN
    RETURN v_tok.project_id;
  END IF;

  SELECT id INTO v_existing
    FROM public.project_collaborators
    WHERE project_id = v_tok.project_id AND user_id = v_user_id;

  IF v_existing IS NULL THEN
    INSERT INTO public.project_collaborators (project_id, user_id, role, status, invited_by, accepted_at)
    VALUES (v_tok.project_id, v_user_id, 'collaborator', 'accepted', v_tok.created_by, now());
  ELSE
    UPDATE public.project_collaborators
      SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
      WHERE id = v_existing AND status <> 'accepted';
  END IF;

  RETURN v_tok.project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_guest_token_to_collaborator(uuid) TO authenticated;