-- Minimal per-user daily counter for AI-calling edge functions (_shared/aiRateLimit.ts).
--
-- Same schema and function as 20260910160000 (+ the caller-identity check from 20260910180000),
-- reduced to what the code needs, and executable by service_role only: every caller passes the
-- service-role client (checkAiFeatureRateLimit(admin, ...)), so no client role needs access.
-- Idempotent and purely additive (no existing table, function or policy is touched).
--
-- Not included on purpose: client SELECT policy, cleanup job, extra indexes (the primary key is
-- the lookup index), per-feature caps (call sites pass -1 = count only).

CREATE TABLE IF NOT EXISTS public.ai_feature_usage (
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_key, usage_date)
);

-- RLS on with no policy: clients cannot read or write; the SECURITY DEFINER function below does.
ALTER TABLE public.ai_feature_usage ENABLE ROW LEVEL SECURITY;

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

  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Not authorized to consume another user''s usage';
  END IF;

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

REVOKE ALL ON FUNCTION public.consume_ai_feature_call(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_feature_call(UUID, TEXT, INTEGER) TO service_role;
