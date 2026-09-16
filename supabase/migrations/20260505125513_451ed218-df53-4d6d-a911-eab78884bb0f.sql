
CREATE TABLE public.guest_studio_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  created_by uuid NOT NULL,
  label text,
  guest_name text,
  guest_email text,
  expires_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_tokens_project ON public.guest_studio_tokens(project_id);
CREATE INDEX idx_guest_tokens_token ON public.guest_studio_tokens(token);

ALTER TABLE public.guest_studio_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view guest tokens"
  ON public.guest_studio_tokens FOR SELECT TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Project members can create guest tokens"
  ON public.guest_studio_tokens FOR INSERT TO authenticated
  WITH CHECK (public.user_has_project_access(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Project members can update guest tokens"
  ON public.guest_studio_tokens FOR UPDATE TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Project members can delete guest tokens"
  ON public.guest_studio_tokens FOR DELETE TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_project_for_guest(_token text)
RETURNS TABLE(
  project_id uuid,
  title text,
  description text,
  workspace_type text,
  status text,
  created_by uuid,
  client_name text,
  cover_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.description, p.workspace_type, p.status, p.created_by, p.client_name, p.cover_url
  FROM public.projects p
  JOIN public.guest_studio_tokens g ON g.project_id = p.id
  WHERE g.token = _token
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_for_guest(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_guest_session(
  _token text,
  _name text DEFAULT NULL,
  _email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.guest_studio_tokens
  SET
    guest_name = COALESCE(NULLIF(_name, ''), guest_name),
    guest_email = COALESCE(NULLIF(_email, ''), guest_email),
    last_seen_at = now()
  WHERE token = _token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_guest_session(text, text, text) TO anon, authenticated;

-- Brief lookup for a guest (returns latest brief for the project)
CREATE OR REPLACE FUNCTION public.get_guest_brief(_token text)
RETURNS TABLE(brief_text text, project_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.description, p.id
  FROM public.projects p
  JOIN public.guest_studio_tokens g ON g.project_id = p.id
  WHERE g.token = _token
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_brief(text) TO anon, authenticated;
