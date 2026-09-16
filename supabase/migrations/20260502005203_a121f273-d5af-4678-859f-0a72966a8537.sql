-- ============================================================
-- PHASE A: Guest Review Links
-- ============================================================

-- 1. project_share_links
CREATE TABLE public.project_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  scope TEXT NOT NULL DEFAULT 'project' CHECK (scope IN ('project','folder','deliverable')),
  scope_ref_id UUID,
  label TEXT,
  can_comment BOOLEAN NOT NULL DEFAULT true,
  can_approve BOOLEAN NOT NULL DEFAULT true,
  can_download BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_share_links_project ON public.project_share_links(project_id);
CREATE INDEX idx_project_share_links_token ON public.project_share_links(token);

ALTER TABLE public.project_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members manage share links"
ON public.project_share_links FOR ALL
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

-- 2. share_link_views (audit log)
CREATE TABLE public.share_link_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.project_share_links(id) ON DELETE CASCADE,
  viewer_name TEXT,
  viewer_email TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_link_views_link ON public.share_link_views(share_link_id);

ALTER TABLE public.share_link_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a view"
ON public.share_link_views FOR INSERT
WITH CHECK (true);

CREATE POLICY "Project members read views"
ON public.share_link_views FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.project_share_links sl
  WHERE sl.id = share_link_id AND public.is_project_member(sl.project_id, auth.uid())
));

-- 3. share_link_approvals
CREATE TABLE public.share_link_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.project_share_links(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES public.project_deliverables(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.project_files(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved','revision_requested')),
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_link_approvals_link ON public.share_link_approvals(share_link_id);
CREATE INDEX idx_share_link_approvals_deliverable ON public.share_link_approvals(deliverable_id);

ALTER TABLE public.share_link_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit approval via valid link"
ON public.share_link_approvals FOR INSERT
WITH CHECK (true);

CREATE POLICY "Project members read approvals"
ON public.share_link_approvals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.project_share_links sl
  WHERE sl.id = share_link_id AND public.is_project_member(sl.project_id, auth.uid())
));

-- 4. Trigger: updated_at
CREATE TRIGGER trg_project_share_links_updated
BEFORE UPDATE ON public.project_share_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Security-definer resolver: validates token & returns safe payload
CREATE OR REPLACE FUNCTION public.resolve_project_share_link(
  _token TEXT,
  _password TEXT DEFAULT NULL
)
RETURNS TABLE (
  share_link_id UUID,
  project_id UUID,
  project_title TEXT,
  scope TEXT,
  scope_ref_id UUID,
  label TEXT,
  can_comment BOOLEAN,
  can_approve BOOLEAN,
  can_download BOOLEAN,
  requires_password BOOLEAN,
  password_ok BOOLEAN,
  expired BOOLEAN,
  revoked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.project_share_links%ROWTYPE;
  _proj public.projects%ROWTYPE;
  _pwd_ok BOOLEAN := true;
  _expired BOOLEAN := false;
  _revoked BOOLEAN := false;
BEGIN
  SELECT * INTO _link FROM public.project_share_links WHERE token = _token;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO _proj FROM public.projects WHERE id = _link.project_id;

  _expired := _link.expires_at IS NOT NULL AND _link.expires_at < now();
  _revoked := _link.revoked_at IS NOT NULL;

  IF _link.password_hash IS NOT NULL THEN
    _pwd_ok := _password IS NOT NULL AND crypt(_password, _link.password_hash) = _link.password_hash;
  END IF;

  RETURN QUERY SELECT
    _link.id,
    _link.project_id,
    _proj.title,
    _link.scope,
    _link.scope_ref_id,
    _link.label,
    _link.can_comment,
    _link.can_approve,
    _link.can_download,
    (_link.password_hash IS NOT NULL),
    _pwd_ok,
    _expired,
    _revoked;
END;
$$;

-- Enable pgcrypto for crypt() if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 6. Function: log a view (rate-limited via app)
CREATE OR REPLACE FUNCTION public.log_share_link_view(
  _token TEXT,
  _viewer_name TEXT DEFAULT NULL,
  _viewer_email TEXT DEFAULT NULL,
  _ip_hash TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link_id UUID;
BEGIN
  SELECT id INTO _link_id FROM public.project_share_links
  WHERE token = _token AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  IF _link_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.share_link_views(share_link_id, viewer_name, viewer_email, ip_hash, user_agent)
  VALUES (_link_id, _viewer_name, _viewer_email, _ip_hash, _user_agent);

  UPDATE public.project_share_links
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = _link_id;
END;
$$;

-- 7. Function: list files visible to a share link (respects scope)
CREATE OR REPLACE FUNCTION public.list_share_link_files(_token TEXT)
RETURNS TABLE (
  file_id UUID,
  name TEXT,
  storage_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  folder TEXT,
  created_at TIMESTAMPTZ,
  deliverable_id UUID,
  deliverable_title TEXT,
  deliverable_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.project_share_links%ROWTYPE;
BEGIN
  SELECT * INTO _link FROM public.project_share_links
  WHERE token = _token AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN; END IF;

  IF _link.scope = 'project' THEN
    RETURN QUERY
    SELECT f.id, f.name, f.storage_path, f.mime_type, f.size_bytes, f.folder, f.created_at,
           d.id, d.title, d.status
    FROM public.project_files f
    LEFT JOIN public.project_deliverables d ON d.id = f.deliverable_id
    WHERE f.project_id = _link.project_id
    ORDER BY f.created_at DESC;
  ELSIF _link.scope = 'folder' THEN
    RETURN QUERY
    SELECT f.id, f.name, f.storage_path, f.mime_type, f.size_bytes, f.folder, f.created_at,
           d.id, d.title, d.status
    FROM public.project_files f
    LEFT JOIN public.project_deliverables d ON d.id = f.deliverable_id
    WHERE f.project_id = _link.project_id AND f.folder = _link.label
    ORDER BY f.created_at DESC;
  ELSIF _link.scope = 'deliverable' THEN
    RETURN QUERY
    SELECT f.id, f.name, f.storage_path, f.mime_type, f.size_bytes, f.folder, f.created_at,
           d.id, d.title, d.status
    FROM public.project_files f
    LEFT JOIN public.project_deliverables d ON d.id = f.deliverable_id
    WHERE f.deliverable_id = _link.scope_ref_id
    ORDER BY f.created_at DESC;
  END IF;
END;
$$;