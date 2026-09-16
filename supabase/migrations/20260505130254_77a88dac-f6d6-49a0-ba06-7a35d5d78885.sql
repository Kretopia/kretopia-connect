
ALTER TABLE public.studio_pulse_posts
  ALTER COLUMN author_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text;

CREATE OR REPLACE FUNCTION public.get_guest_files(_token text)
RETURNS TABLE(
  id uuid, file_name text, file_url text, file_type text, file_size bigint, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.file_name, f.file_url, f.file_type, f.file_size, f.created_at
  FROM public.project_files f
  JOIN public.guest_studio_tokens g ON g.project_id = f.project_id
  WHERE g.token = _token AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  ORDER BY f.created_at DESC LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.get_guest_files(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_collaborators(_token text)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pc.user_id, p.full_name, p.avatar_url, pc.role
  FROM public.project_collaborators pc
  JOIN public.profiles p ON p.user_id = pc.user_id
  JOIN public.guest_studio_tokens g ON g.project_id = pc.project_id
  WHERE g.token = _token AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
    AND pc.status = 'accepted'
  LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.get_guest_collaborators(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_pulse(_token text)
RETURNS TABLE(
  id uuid, content text, kind text, image_urls text[], created_at timestamptz,
  author_name text, is_guest boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.id, pp.content, pp.kind, pp.image_urls, pp.created_at,
    COALESCE(pr.full_name, pp.guest_name, 'Guest') AS author_name,
    (pp.author_id IS NULL) AS is_guest
  FROM public.studio_pulse_posts pp
  LEFT JOIN public.profiles pr ON pr.user_id = pp.author_id
  JOIN public.guest_studio_tokens g ON g.project_id = pp.project_id
  WHERE g.token = _token AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  ORDER BY pp.created_at DESC LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.get_guest_pulse(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_drop_post(
  _token text, _content text, _kind text DEFAULT 'note'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token public.guest_studio_tokens%ROWTYPE;
  v_post_id uuid;
BEGIN
  SELECT * INTO v_token FROM public.guest_studio_tokens
  WHERE token = _token AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now()) LIMIT 1;
  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired guest token';
  END IF;
  IF _content IS NULL OR length(trim(_content)) = 0 THEN
    RAISE EXCEPTION 'Content required';
  END IF;
  INSERT INTO public.studio_pulse_posts (project_id, author_id, content, kind, guest_name, guest_email)
  VALUES (v_token.project_id, NULL, left(_content, 4000), COALESCE(_kind, 'note'), v_token.guest_name, v_token.guest_email)
  RETURNING id INTO v_post_id;
  UPDATE public.guest_studio_tokens SET last_seen_at = now() WHERE id = v_token.id;
  RETURN v_post_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.guest_drop_post(text, text, text) TO anon, authenticated;
