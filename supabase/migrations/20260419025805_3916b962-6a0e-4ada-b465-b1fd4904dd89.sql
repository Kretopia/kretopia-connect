-- 1. Moderation fields on campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_score INTEGER,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID;

CREATE INDEX IF NOT EXISTS idx_campaigns_moderation_status ON public.campaigns(moderation_status);

-- 2. Moderation queue for human review
CREATE TABLE IF NOT EXISTS public.campaign_moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_categories TEXT[] DEFAULT '{}',
  ai_reason TEXT,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewer_id UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mod_queue_status ON public.campaign_moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_mod_queue_campaign ON public.campaign_moderation_queue(campaign_id);

ALTER TABLE public.campaign_moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage moderation queue"
  ON public.campaign_moderation_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators view their own queue items"
  ON public.campaign_moderation_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_moderation_queue.campaign_id
        AND c.creator_id = auth.uid()
    )
  );

CREATE TRIGGER update_mod_queue_updated_at
  BEFORE UPDATE ON public.campaign_moderation_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Age verification on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT false;

-- 4. Tighten public visibility: only approved campaigns visible to non-creators
DROP POLICY IF EXISTS "Public can view active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Public can view approved active campaigns" ON public.campaigns;

CREATE POLICY "Public can view approved active campaigns"
  ON public.campaigns
  FOR SELECT
  USING (
    status IN ('active','funded','completed')
    AND moderation_status = 'approved'
  );

-- Creators can always see their own (any status)
DROP POLICY IF EXISTS "Creators view own campaigns" ON public.campaigns;
CREATE POLICY "Creators view own campaigns"
  ON public.campaigns
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Admins see all
DROP POLICY IF EXISTS "Admins view all campaigns" ON public.campaigns;
CREATE POLICY "Admins view all campaigns"
  ON public.campaigns
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));