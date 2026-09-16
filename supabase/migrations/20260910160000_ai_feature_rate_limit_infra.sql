-- "Bible" item: AI rate limits.
--
-- thrive-ai-chat already has a real, working per-tier daily cap
-- (consume_copilot_message / desk_ai_usage, 20260502231733) but it is
-- scoped specifically to Copilot messages. Per SECURITY_RELEASE_GATE.md §G,
-- "the other ~100 AI-calling edge functions weren't swept for the same
-- gap" -- most AI-calling functions (generate-*, spark-ideas,
-- ai-autofill-profile, draft-*, gen-*, etc.) have no per-user call limit
-- at all today, only auth.
--
-- This migration generalizes the proven desk_ai_usage/consume_copilot_message
-- pattern into a reusable, feature-keyed primitive any edge function can
-- call, instead of each function inventing its own counter table.
--
-- Exact per-feature daily caps are a product/cost decision (they depend on
-- model cost, plan tier, and abuse tolerance the team hasn't set yet) --
-- NOT implemented here. Every call site created in this pass passes
-- _daily_cap = -1 (unlimited, i.e. count-only, matching
-- consume_copilot_message's existing "-1 means unlimited" convention) so
-- nothing changes behaviorally for any current user; only the counting
-- infrastructure and the enforcement mechanism go live now. Flipping a
-- feature from unlimited to capped afterward is a one-line config change
-- (supabase/functions/_shared/aiRateLimit.ts), not a schema or deploy
-- change. TODO product decision: real per-feature/per-tier cap values.

CREATE TABLE IF NOT EXISTS public.ai_feature_usage (
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_key, usage_date)
);

ALTER TABLE public.ai_feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI feature usage"
ON public.ai_feature_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No client INSERT/UPDATE policy at all: every write happens inside the
-- SECURITY DEFINER function below, exactly like desk_ai_usage.

CREATE OR REPLACE FUNCTION public.consume_ai_feature_call(
  _user_id UUID,
  _feature_key TEXT,
  _daily_cap INTEGER
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, cap INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF _user_id IS NULL OR _feature_key IS NULL OR length(_feature_key) = 0 THEN
    RAISE EXCEPTION 'user_id and feature_key are required';
  END IF;

  -- -1 cap means unlimited (count-only) -- matches consume_copilot_message.
  IF _daily_cap = -1 THEN
    INSERT INTO public.ai_feature_usage (user_id, feature_key, usage_date, call_count)
    VALUES (_user_id, _feature_key, CURRENT_DATE, 1)
    ON CONFLICT (user_id, feature_key, usage_date)
    DO UPDATE SET call_count = ai_feature_usage.call_count + 1, updated_at = now()
    RETURNING call_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  SELECT call_count INTO v_count
  FROM public.ai_feature_usage
  WHERE user_id = _user_id AND feature_key = _feature_key AND usage_date = CURRENT_DATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= _daily_cap THEN
    RETURN QUERY SELECT false, v_count, _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.ai_feature_usage (user_id, feature_key, usage_date, call_count)
  VALUES (_user_id, _feature_key, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature_key, usage_date)
  DO UPDATE SET call_count = ai_feature_usage.call_count + 1, updated_at = now()
  RETURNING call_count INTO v_count;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_feature_call(UUID, TEXT, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_feature_call(UUID, TEXT, INTEGER) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_ai_feature_usage_lookup
  ON public.ai_feature_usage (user_id, feature_key, usage_date);
