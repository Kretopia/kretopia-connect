
-- =============================================
-- APPROVAL WORKFLOWS
-- =============================================

CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.project_files(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'revision_requested', 'rejected')),
  submitted_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  media_type TEXT DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliverable_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id UUID NOT NULL REFERENCES public.project_deliverables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  annotation_x REAL,
  annotation_y REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliverable_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id UUID NOT NULL REFERENCES public.project_deliverables(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_by UUID NOT NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CREATIVE ASSET LIBRARY
-- =============================================

CREATE TABLE IF NOT EXISTS public.asset_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.asset_folders(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#6366f1',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creative_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.asset_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT DEFAULT 0,
  file_type TEXT,
  media_type TEXT DEFAULT 'document',
  tags TEXT[] DEFAULT '{}',
  version INTEGER DEFAULT 1,
  uploaded_by UUID NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.creative_assets(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID NOT NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Add icon/color to project_templates
-- =============================================
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📁';
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project members can view deliverables') THEN
    CREATE POLICY "Project members can view deliverables" ON public.project_deliverables FOR SELECT USING (public.user_has_project_access(project_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project members can create deliverables') THEN
    CREATE POLICY "Project members can create deliverables" ON public.project_deliverables FOR INSERT WITH CHECK (public.user_has_project_access(project_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project members can update deliverables') THEN
    CREATE POLICY "Project members can update deliverables" ON public.project_deliverables FOR UPDATE USING (public.user_has_project_access(project_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Submitter can delete deliverables') THEN
    CREATE POLICY "Submitter can delete deliverables" ON public.project_deliverables FOR DELETE USING (submitted_by = auth.uid());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can view deliverable comments') THEN
    CREATE POLICY "Members can view deliverable comments" ON public.deliverable_comments FOR SELECT USING (EXISTS (SELECT 1 FROM public.project_deliverables d WHERE d.id = deliverable_id AND public.user_has_project_access(d.project_id, auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can create deliverable comments') THEN
    CREATE POLICY "Members can create deliverable comments" ON public.deliverable_comments FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.project_deliverables d WHERE d.id = deliverable_id AND public.user_has_project_access(d.project_id, auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own deliverable comments') THEN
    CREATE POLICY "Users can delete own deliverable comments" ON public.deliverable_comments FOR DELETE USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can view deliverable versions') THEN
    CREATE POLICY "Members can view deliverable versions" ON public.deliverable_versions FOR SELECT USING (EXISTS (SELECT 1 FROM public.project_deliverables d WHERE d.id = deliverable_id AND public.user_has_project_access(d.project_id, auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can create deliverable versions') THEN
    CREATE POLICY "Members can create deliverable versions" ON public.deliverable_versions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.project_deliverables d WHERE d.id = deliverable_id AND public.user_has_project_access(d.project_id, auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can manage asset folders') THEN
    CREATE POLICY "Members can manage asset folders" ON public.asset_folders FOR ALL USING (public.user_has_project_access(project_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can manage creative assets') THEN
    CREATE POLICY "Members can manage creative assets" ON public.creative_assets FOR ALL USING (public.user_has_project_access(project_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can manage asset versions') THEN
    CREATE POLICY "Members can manage asset versions" ON public.asset_versions FOR ALL USING (EXISTS (SELECT 1 FROM public.creative_assets a WHERE a.id = asset_id AND public.user_has_project_access(a.project_id, auth.uid())));
  END IF;
END $$;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_deliverables;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deliverable_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.creative_assets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS update_project_deliverables_updated_at ON public.project_deliverables;
CREATE TRIGGER update_project_deliverables_updated_at BEFORE UPDATE ON public.project_deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliverable_comments_updated_at ON public.deliverable_comments;
CREATE TRIGGER update_deliverable_comments_updated_at BEFORE UPDATE ON public.deliverable_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_asset_folders_updated_at ON public.asset_folders;
CREATE TRIGGER update_asset_folders_updated_at BEFORE UPDATE ON public.asset_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_creative_assets_updated_at ON public.creative_assets;
CREATE TRIGGER update_creative_assets_updated_at BEFORE UPDATE ON public.creative_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
