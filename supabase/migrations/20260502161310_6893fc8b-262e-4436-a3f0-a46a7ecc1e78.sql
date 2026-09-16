
CREATE TABLE public.studio_pulse_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text,
  image_urls text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'pending',
  routed_to text,
  routed_id uuid,
  approval_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX studio_pulse_posts_project_idx
  ON public.studio_pulse_posts (project_id, created_at DESC);

ALTER TABLE public.studio_pulse_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pulse posts"
  ON public.studio_pulse_posts
  FOR SELECT
  TO authenticated
  USING (user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Members can create pulse posts"
  ON public.studio_pulse_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND user_has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Authors and owners can update pulse posts"
  ON public.studio_pulse_posts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_pulse_posts.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Authors and owners can delete pulse posts"
  ON public.studio_pulse_posts
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_pulse_posts.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE TRIGGER trg_studio_pulse_posts_updated_at
  BEFORE UPDATE ON public.studio_pulse_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_pulse_posts;
ALTER TABLE public.studio_pulse_posts REPLICA IDENTITY FULL;
