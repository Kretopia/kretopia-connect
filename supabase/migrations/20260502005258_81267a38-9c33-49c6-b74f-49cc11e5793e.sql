DROP FUNCTION IF EXISTS public.list_share_link_files(TEXT);

CREATE OR REPLACE FUNCTION public.list_share_link_files(_token TEXT)
RETURNS TABLE (
  file_id UUID,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  folder_id UUID,
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
    SELECT f.id, f.file_name, f.file_url, f.file_type, f.file_size::bigint, f.folder_id, f.created_at,
           d.id, d.title, d.status
    FROM public.project_files f
    LEFT JOIN public.project_deliverables d ON d.id = f.deliverable_id
    WHERE f.project_id = _link.project_id
    ORDER BY f.created_at DESC;
  ELSIF _link.scope = 'folder' THEN
    RETURN QUERY
    SELECT f.id, f.file_name, f.file_url, f.file_type, f.file_size::bigint, f.folder_id, f.created_at,
           d.id, d.title, d.status
    FROM public.project_files f
    LEFT JOIN public.project_deliverables d ON d.id = f.deliverable_id
    WHERE f.project_id = _link.project_id AND f.folder_id = _link.scope_ref_id
    ORDER BY f.created_at DESC;
  ELSIF _link.scope = 'deliverable' THEN
    RETURN QUERY
    SELECT f.id, f.file_name, f.file_url, f.file_type, f.file_size::bigint, f.folder_id, f.created_at,
           d.id, d.title, d.status
    FROM public.project_files f
    LEFT JOIN public.project_deliverables d ON d.id = f.deliverable_id
    WHERE f.deliverable_id = _link.scope_ref_id
    ORDER BY f.created_at DESC;
  END IF;
END;
$$;