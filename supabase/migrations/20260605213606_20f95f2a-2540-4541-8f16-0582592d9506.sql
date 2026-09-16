
-- Phase C: Brand Vault — persistent brand identity that every generated
-- document/deck/proposal auto-inherits. One row per (user, optional project).
CREATE TABLE public.brand_vaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT,
  logo_dark_url TEXT,
  palette JSONB NOT NULL DEFAULT '[]'::jsonb,
  fonts JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_tone TEXT,
  tagline TEXT,
  do_dont JSONB NOT NULL DEFAULT '{"do":[],"dont":[]}'::jsonb,
  links JSONB NOT NULL DEFAULT '{}'::jsonb,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brand_vaults_user_idx ON public.brand_vaults(user_id);
CREATE INDEX brand_vaults_project_idx ON public.brand_vaults(project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX brand_vaults_one_default_per_user
  ON public.brand_vaults(user_id) WHERE is_default = true AND project_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_vaults TO authenticated;
GRANT ALL ON public.brand_vaults TO service_role;

ALTER TABLE public.brand_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage their brand vaults"
  ON public.brand_vaults FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Project members can READ a project-attached brand vault (so generated docs
-- in a shared Studio use the owner's brand).
CREATE POLICY "Project members can read project brand vaults"
  ON public.brand_vaults FOR SELECT
  USING (
    project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = brand_vaults.project_id AND pc.user_id = auth.uid())
    )
  );

CREATE TRIGGER brand_vaults_updated_at
  BEFORE UPDATE ON public.brand_vaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
