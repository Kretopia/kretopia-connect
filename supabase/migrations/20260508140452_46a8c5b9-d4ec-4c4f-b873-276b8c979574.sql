
-- Campaign Studio tables
CREATE TABLE public.campaign_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  updated_by UUID,
  brand_name TEXT,
  objective TEXT,
  audience TEXT,
  tone TEXT,
  key_messages TEXT[] NOT NULL DEFAULT '{}',
  guidelines TEXT,
  kpis TEXT[] NOT NULL DEFAULT '{}',
  budget NUMERIC,
  currency TEXT DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_briefs_project ON public.campaign_briefs(project_id, is_current);

CREATE TABLE public.campaign_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  platform TEXT,                 -- instagram, tiktok, youtube, x, linkedin, ooh, email...
  format TEXT,                   -- reel, carousel, story, 30s spot, billboard...
  deliverable TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'organic', -- paid | organic | both
  owner_id UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'idea',     -- idea | in_progress | review | approved | scheduled | published
  asset_url TEXT,
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_assets_project ON public.campaign_assets(project_id, order_index);

CREATE TABLE public.campaign_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.campaign_assets(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  reviewer_id UUID,
  title TEXT NOT NULL,
  asset_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | changes_requested | rejected
  feedback TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_approvals_project ON public.campaign_approvals(project_id, status);

ALTER TABLE public.campaign_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_approvals ENABLE ROW LEVEL SECURITY;

-- Reuse is_project_member SECURITY DEFINER from content studio migration
CREATE POLICY "Members read campaign briefs" ON public.campaign_briefs FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write campaign briefs" ON public.campaign_briefs FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update campaign briefs" ON public.campaign_briefs FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete campaign briefs" ON public.campaign_briefs FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members read campaign assets" ON public.campaign_assets FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write campaign assets" ON public.campaign_assets FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update campaign assets" ON public.campaign_assets FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete campaign assets" ON public.campaign_assets FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members read campaign approvals" ON public.campaign_approvals FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write campaign approvals" ON public.campaign_approvals FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update campaign approvals" ON public.campaign_approvals FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete campaign approvals" ON public.campaign_approvals FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER trg_campaign_briefs_updated BEFORE UPDATE ON public.campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaign_assets_updated BEFORE UPDATE ON public.campaign_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaign_approvals_updated BEFORE UPDATE ON public.campaign_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
