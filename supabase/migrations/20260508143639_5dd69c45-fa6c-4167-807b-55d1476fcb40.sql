
-- Opportunity Intel Digests
CREATE TABLE public.opportunity_intel_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('daily_match','sponsor_radar','epk_refresh','weekly_intel')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_oid_user_kind_gen ON public.opportunity_intel_digests(user_id, kind, generated_at DESC);
ALTER TABLE public.opportunity_intel_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own digests select" ON public.opportunity_intel_digests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own digests insert" ON public.opportunity_intel_digests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own digests update" ON public.opportunity_intel_digests FOR UPDATE USING (auth.uid() = user_id);

-- Sponsor Leads
CREATE TABLE public.sponsor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  brand_name TEXT NOT NULL,
  brand_url TEXT,
  brand_logo_url TEXT,
  niche TEXT,
  fit_score INTEGER NOT NULL DEFAULT 50 CHECK (fit_score BETWEEN 0 AND 100),
  reason TEXT,
  contact_info JSONB DEFAULT '{}'::jsonb,
  pitch_draft TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','saved','contacted','dismissed','won')),
  source TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sponsor_leads_user_status ON public.sponsor_leads(user_id, status, fit_score DESC);
ALTER TABLE public.sponsor_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leads select" ON public.sponsor_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own leads insert" ON public.sponsor_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own leads update" ON public.sponsor_leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own leads delete" ON public.sponsor_leads FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_sponsor_leads_updated BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EPK Refresh Suggestions
CREATE TABLE public.epk_refresh_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bio','headline','featured_credit','rate_card','reel','reviews','stats')),
  current_value TEXT,
  suggested_value TEXT,
  reason TEXT,
  trigger_event TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);
CREATE INDEX idx_epk_refresh_user_status ON public.epk_refresh_suggestions(user_id, status, created_at DESC);
ALTER TABLE public.epk_refresh_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own epk select" ON public.epk_refresh_suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own epk insert" ON public.epk_refresh_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own epk update" ON public.epk_refresh_suggestions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own epk delete" ON public.epk_refresh_suggestions FOR DELETE USING (auth.uid() = user_id);
