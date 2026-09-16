-- Comments on Studio Pulse posts
CREATE TABLE public.studio_pulse_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.studio_pulse_posts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_pulse_comments_post ON public.studio_pulse_comments(post_id, created_at);
CREATE INDEX idx_studio_pulse_comments_project ON public.studio_pulse_comments(project_id);

ALTER TABLE public.studio_pulse_comments ENABLE ROW LEVEL SECURITY;

-- Helper: project membership check (mirrors patterns used by studio_pulse_posts)
CREATE POLICY "Project members can view pulse comments"
ON public.studio_pulse_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = studio_pulse_comments.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_collaborators pc
          WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Project members can add pulse comments"
ON public.studio_pulse_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = studio_pulse_comments.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_collaborators pc
          WHERE pc.project_id = p.id AND pc.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Authors can delete their pulse comments"
ON public.studio_pulse_comments
FOR DELETE
TO authenticated
USING (author_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_pulse_comments;
