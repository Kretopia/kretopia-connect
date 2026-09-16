-- Project guest links: shareable join tokens for Studio guests
CREATE TABLE IF NOT EXISTS public.project_guest_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  label TEXT,
  permissions JSONB NOT NULL DEFAULT '{"comment":true,"upload":true,"call":true}'::jsonb,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_guest_links_project ON public.project_guest_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_guest_links_token ON public.project_guest_links(token);

ALTER TABLE public.project_guest_links ENABLE ROW LEVEL SECURITY;

-- Owners + accepted members can manage guest links
CREATE POLICY "Project members can view guest links"
ON public.project_guest_links FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = project_guest_links.project_id
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
  )
);

CREATE POLICY "Project members can create guest links"
ON public.project_guest_links FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_guest_links.project_id
        AND pc.user_id = auth.uid()
        AND pc.status = 'accepted'
    )
  )
);

CREATE POLICY "Project owners can revoke guest links"
ON public.project_guest_links FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

CREATE POLICY "Project owners can delete guest links"
ON public.project_guest_links FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_project_guest_links_updated_at ON public.project_guest_links;
CREATE TRIGGER update_project_guest_links_updated_at
BEFORE UPDATE ON public.project_guest_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();