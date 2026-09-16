-- "Bible" item: opportunity publishing caps -- this time with the REAL,
-- already-decided product value, not a placeholder.
--
-- src/lib/subscriptionLimits.ts already defines and ships
-- FREE_TIER_MONTHLY_CAPS.gigPosts = 3 ("Creator gig/event posts per
-- month"), with pro/creator_pro/founder/brand_pro/brand_enterprise all at
-- -1 (unlimited). src/components/PostOpportunityDialog.tsx -- the actual
-- opportunity-creation UI -- already gates on this exact value via
-- useFeatureGate("gigPosts") before inserting into public.opportunities.
--
-- But src/hooks/useFeatureUsage.ts's own top comment admits the
-- enforcement mechanism: "Uses localStorage for lightweight tracking (no
-- extra DB table needed)." That means the cap is 100% client-side and
-- trivially bypassed (clear localStorage, private window, or skip the
-- dialog and call the insert directly) -- the product decision is real,
-- the number is real, but nothing server-side has ever enforced it.
--
-- This migration enforces the existing decision server-side via a
-- BEFORE INSERT trigger, using the exact same atomic
-- check-and-increment-in-one-statement pattern already proven for
-- desk_ai_usage/studio_ai_usage/ai_feature_usage this session, keyed by
-- calendar month rather than day.
--
-- Scope: only applies to real, registered-user-attributed posts
-- (created_by IS NOT NULL). Guest posts always have created_by IS NULL
-- (enforced by 20260910160100_close_guest_opportunity_anon_bypass.sql)
-- and go through their own separate email-verification funnel --
-- correctly out of scope for a per-user subscription-tier quota. This
-- is a genuine gap-fill of an existing, already-shipped decision, not a
-- new business rule -- no "TODO product decision" needed for this one.
--
-- This is additive to (not a replacement for) last session's
-- enforce_opportunity_publish_cap() trigger (concurrent-active-count
-- cap, still a placeholder pending a real value) -- the two measure
-- different things (how many can be live at once vs. how many can be
-- posted per month) and are not in conflict.

CREATE TABLE IF NOT EXISTS public.opportunity_publish_usage (
  user_id UUID NOT NULL,
  month_key TEXT NOT NULL, -- 'YYYY-MM'
  post_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_key)
);

ALTER TABLE public.opportunity_publish_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own opportunity publish usage"
ON public.opportunity_publish_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No client INSERT/UPDATE policy at all -- every write happens inside the
-- SECURITY DEFINER function below, matching ai_feature_usage's pattern
-- (and unlike desk_ai_usage/studio_ai_usage's original direct-write
-- policies, which this session's 20260910180000 migration had to close
-- as a live bypass).

CREATE OR REPLACE FUNCTION public.consume_opportunity_publish_slot(
  _user_id UUID,
  _month_key TEXT,
  _monthly_cap INTEGER
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, cap INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Not authorized to consume another user''s usage';
  END IF;

  IF _monthly_cap = -1 THEN
    INSERT INTO public.opportunity_publish_usage (user_id, month_key, post_count)
    VALUES (_user_id, _month_key, 1)
    ON CONFLICT (user_id, month_key)
    DO UPDATE SET post_count = opportunity_publish_usage.post_count + 1, updated_at = now()
    RETURNING post_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  SELECT post_count INTO v_count
  FROM public.opportunity_publish_usage
  WHERE user_id = _user_id AND month_key = _month_key;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= _monthly_cap THEN
    RETURN QUERY SELECT false, v_count, _monthly_cap;
    RETURN;
  END IF;

  INSERT INTO public.opportunity_publish_usage (user_id, month_key, post_count)
  VALUES (_user_id, _month_key, 1)
  ON CONFLICT (user_id, month_key)
  DO UPDATE SET post_count = opportunity_publish_usage.post_count + 1, updated_at = now()
  RETURNING post_count INTO v_count;

  RETURN QUERY SELECT true, v_count, _monthly_cap;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_opportunity_publish_slot(UUID, TEXT, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_opportunity_publish_slot(UUID, TEXT, INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_opportunity_monthly_posting_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_cap INTEGER;
  v_result RECORD;
BEGIN
  -- Guest/system posts (no attributable registered user) are out of
  -- scope -- they go through their own email-verification funnel, not a
  -- subscription-tier quota.
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subscription_tier INTO v_tier FROM public.profiles WHERE user_id = NEW.created_by;

  -- Mirrors src/lib/subscriptionLimits.ts: only 'free' has a real cap for
  -- gigPosts (3/month); every other tier is unlimited (-1).
  v_cap := CASE WHEN COALESCE(v_tier, 'free') = 'free' THEN 3 ELSE -1 END;

  SELECT * INTO v_result
  FROM public.consume_opportunity_publish_slot(NEW.created_by, to_char(now(), 'YYYY-MM'), v_cap);

  IF NOT v_result.allowed THEN
    RAISE EXCEPTION 'Monthly opportunity posting limit reached (%/%). Upgrade to post more this month.', v_result.used, v_result.cap
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opportunities_enforce_monthly_posting_cap ON public.opportunities;
CREATE TRIGGER opportunities_enforce_monthly_posting_cap
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_monthly_posting_cap();
