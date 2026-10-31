-- Atomic reserve-then-commit rate limiter for public.consume_ai_feature_call.
--
-- The previous definition performed a separate SELECT followed by a conditional
-- INSERT/UPDATE. Two concurrent requests could both read the same count and both
-- pass the cap check, so the daily cap was not strict under concurrency.
--
-- This replacement performs a single INSERT ... ON CONFLICT ... DO UPDATE with the
-- cap enforced inside the UPDATE's WHERE clause. Postgres takes a row-level lock on
-- the conflicting row for the duration of the statement, so concurrent calls are
-- serialized per (user_id, feature_key, usage_date) and the cap holds exactly.
--
-- NOT EXECUTED by the agent. Apply through the normal migration pipeline.

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

  -- Single atomic statement: the increment only happens while the row is under the
  -- cap, and the row lock serializes concurrent callers.
  INSERT INTO public.ai_feature_usage (user_id, feature_key, usage_date, call_count)
  VALUES (_user_id, _feature_key, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature_key, usage_date)
  DO UPDATE SET call_count = ai_feature_usage.call_count + 1, updated_at = now()
  WHERE ai_feature_usage.call_count < _daily_cap
  RETURNING call_count INTO v_count;

  IF v_count IS NULL THEN
    -- Row exists and is already at or over the cap: report denial without mutating.
    SELECT call_count INTO v_count
    FROM public.ai_feature_usage
    WHERE user_id = _user_id AND feature_key = _feature_key AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

-- Privileges unchanged from the original definition: the function remains
-- security-definer and is revoked from client roles by
-- 20261006120000_restrict_ai_usage_counter_rpcs.sql.
