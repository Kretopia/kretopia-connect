-- =============================================
-- THRIVEFUND PHASE 1: Foundation
-- =============================================

-- 1. Add hidden backer flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_hidden_backer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_hidden_backer
  ON public.profiles(is_hidden_backer) WHERE is_hidden_backer = false;

-- 2. Rebuild public_profiles_safe view to exclude hidden backers
DROP VIEW IF EXISTS public.public_profiles_safe CASCADE;

CREATE VIEW public.public_profiles_safe
WITH (security_invoker = true)
AS
SELECT user_id, full_name, avatar_url, role, bio, location,
       professional_skills, badge, xp, level, onboarding_completed,
       account_type, instagram_url, tiktok_url, youtube_url, twitter_url,
       linkedin_url, id_verified, verification_status, verification_tier,
       membership_number, cover_image_url, behance_url, imdb_url,
       soundcloud_url, spotify_url, created_at, updated_at
FROM public.profiles
WHERE is_hidden_backer = false;

GRANT SELECT ON public.public_profiles_safe TO anon, authenticated;

-- 3. Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  tagline text,
  story text,
  category text,
  cover_image_url text,
  video_url text,
  goal_amount numeric(12,2) NOT NULL CHECK (goal_amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  total_raised numeric(12,2) NOT NULL DEFAULT 0,
  backer_count integer NOT NULL DEFAULT 0,
  deadline timestamptz NOT NULL,
  funding_model text NOT NULL DEFAULT 'all_or_nothing'
    CHECK (funding_model IN ('all_or_nothing','keep_it_all')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','funded','failed','cancelled','completed')),
  platform_fee_pct numeric(4,2) NOT NULL DEFAULT 5.00,
  milestone_split jsonb NOT NULL DEFAULT '[{"label":"On funding","pct":40},{"label":"Milestone 1","pct":30},{"label":"Completion","pct":30}]'::jsonb,
  stripe_account_id text,
  launched_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_creator ON public.campaigns(creator_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_deadline ON public.campaigns(deadline);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON public.campaigns(slug);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view live campaigns"
ON public.campaigns FOR SELECT
USING (status IN ('active','funded','failed','completed'));

CREATE POLICY "Creators can view own campaigns"
ON public.campaigns FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can insert own campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own campaigns"
ON public.campaigns FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete draft campaigns"
ON public.campaigns FOR DELETE
USING (auth.uid() = creator_id AND status = 'draft');

-- 4. Pledge tiers
CREATE TABLE IF NOT EXISTS public.pledge_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  title text NOT NULL,
  description text,
  reward_type text DEFAULT 'digital',
  estimated_delivery date,
  max_backers integer,
  claimed_count integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pledge_tiers_campaign ON public.pledge_tiers(campaign_id);

ALTER TABLE public.pledge_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view tiers of live campaigns"
ON public.pledge_tiers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id
    AND c.status IN ('active','funded','failed','completed')
));

CREATE POLICY "Creators manage own tiers"
ON public.pledge_tiers FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id AND c.creator_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id AND c.creator_id = auth.uid()
));

-- 5. Pledges
CREATE TABLE IF NOT EXISTS public.pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  backer_id uuid NOT NULL,
  tier_id uuid REFERENCES public.pledge_tiers(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  capture_status text NOT NULL DEFAULT 'authorized'
    CHECK (capture_status IN ('authorized','captured','released','refunded','failed','cancelled')),
  is_anonymous boolean NOT NULL DEFAULT false,
  backer_message text,
  shipping_address jsonb,
  pledged_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON public.pledges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pledges_backer ON public.pledges(backer_id);
CREATE INDEX IF NOT EXISTS idx_pledges_status ON public.pledges(capture_status);

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backers view own pledges"
ON public.pledges FOR SELECT
USING (auth.uid() = backer_id);

CREATE POLICY "Creators view pledges to own campaigns"
ON public.pledges FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id AND c.creator_id = auth.uid()
));

CREATE POLICY "Backers create own pledges"
ON public.pledges FOR INSERT
WITH CHECK (auth.uid() = backer_id);

-- 6. Campaign updates
CREATE TABLE IF NOT EXISTS public.campaign_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  media_urls text[],
  backers_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_updates_campaign ON public.campaign_updates(campaign_id);

ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public sees public updates of live campaigns"
ON public.campaign_updates FOR SELECT
USING (
  backers_only = false
  AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.status IN ('active','funded','failed','completed')
  )
);

CREATE POLICY "Backers see backer-only updates"
ON public.campaign_updates FOR SELECT
USING (
  backers_only = true
  AND EXISTS (
    SELECT 1 FROM public.pledges p
    WHERE p.campaign_id = campaign_updates.campaign_id
      AND p.backer_id = auth.uid()
      AND p.capture_status IN ('authorized','captured','released')
  )
);

CREATE POLICY "Creators manage own updates"
ON public.campaign_updates FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id AND c.creator_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id AND c.creator_id = auth.uid()
));

-- 7. Updated-at triggers
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_pledges_updated_at
  BEFORE UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_campaign_updates_updated_at
  BEFORE UPDATE ON public.campaign_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Auto-update campaign totals when pledges change
CREATE OR REPLACE FUNCTION public.refresh_campaign_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  cid := COALESCE(NEW.campaign_id, OLD.campaign_id);
  UPDATE public.campaigns c
  SET total_raised = COALESCE((
        SELECT SUM(amount) FROM public.pledges
        WHERE campaign_id = cid
          AND capture_status IN ('authorized','captured','released')
      ), 0),
      backer_count = COALESCE((
        SELECT COUNT(DISTINCT backer_id) FROM public.pledges
        WHERE campaign_id = cid
          AND capture_status IN ('authorized','captured','released')
      ), 0),
      updated_at = now()
  WHERE c.id = cid;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pledges_refresh_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.refresh_campaign_totals();

-- 9. Auto-update tier claimed_count
CREATE OR REPLACE FUNCTION public.refresh_tier_claimed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
BEGIN
  tid := COALESCE(NEW.tier_id, OLD.tier_id);
  IF tid IS NULL THEN RETURN NEW; END IF;
  UPDATE public.pledge_tiers
  SET claimed_count = COALESCE((
    SELECT COUNT(*) FROM public.pledges
    WHERE tier_id = tid
      AND capture_status IN ('authorized','captured','released')
  ), 0)
  WHERE id = tid;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pledges_refresh_tier_claimed
  AFTER INSERT OR UPDATE OR DELETE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.refresh_tier_claimed();

-- 10. Storage bucket for campaign media
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-media', 'campaign-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view campaign media"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-media');

CREATE POLICY "Users upload to own campaign folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own campaign media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'campaign-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own campaign media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'campaign-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);