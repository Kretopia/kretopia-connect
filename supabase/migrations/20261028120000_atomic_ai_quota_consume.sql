-- Atomic daily AI quota: a cap can no longer be passed by parallel requests.
--
-- consume_copilot_message, consume_studio_ai_generation and consume_ai_feature_call all did, for a capped call:
--   1. SELECT the day's count,
--   2. return "denied" if count >= cap,
--   3. otherwise upsert count + 1.
-- Two requests that both read the same count both pass step 2 and both increment, so a burst of N parallel calls
-- lets up to N through whatever the cap is (thrive-ai-chat enforces the tier cap, or the 500-a-day abuse ceiling
-- while everything is free). The count was right afterwards; the gate was not.
--
-- Now the check and the increment are ONE statement: `INSERT ... ON CONFLICT DO UPDATE ... WHERE count < cap`.
-- Postgres locks the row, a concurrent caller waits for it and re-evaluates the WHERE on the committed row, so
-- exactly `cap` calls get a row back and every other call gets none (denied).
--
-- Unchanged: signatures, return shape (allowed, used, cap), SECURITY DEFINER, search_path, the identity check, the
-- unlimited path (_daily_cap = -1), a cap of 0 or less still denies everything, and the grants (CREATE OR REPLACE
-- keeps them: service_role only, see 20261006120000_restrict_ai_usage_counter_rpcs.sql). One deliberate change: a NULL
-- cap now denies; it used to pass as unlimited by accident (every caller passes a number).
--
-- No schema change, no data change. Not applied to production by the commit that adds this file.
-- Rollback: re-run the previous definitions from 20260910180000_close_ai_usage_counter_bypass.sql
-- (consume_copilot_message, consume_studio_ai_generation) and 20261006160000_create_ai_rate_limit_table.sql
-- (consume_ai_feature_call).

CREATE OR REPLACE FUNCTION public.consume_copilot_message(_user_id uuid, _daily_cap integer)
RETURNS TABLE(allowed boolean, used integer, cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Not authorized to consume another user''s usage';
  END IF;

  IF _daily_cap = -1 THEN
    INSERT INTO public.desk_ai_usage (user_id, usage_date, message_count)
    VALUES (_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET message_count = desk_ai_usage.message_count + 1, updated_at = now()
    RETURNING message_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  IF _daily_cap IS NULL OR _daily_cap <= 0 THEN
    SELECT message_count INTO v_count FROM public.desk_ai_usage WHERE user_id = _user_id AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.desk_ai_usage (user_id, usage_date, message_count)
  VALUES (_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = desk_ai_usage.message_count + 1, updated_at = now()
  WHERE desk_ai_usage.message_count < _daily_cap
  RETURNING message_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT message_count INTO v_count FROM public.desk_ai_usage WHERE user_id = _user_id AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_studio_ai_generation(_user_id uuid, _daily_cap integer)
RETURNS TABLE(allowed boolean, used integer, cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Not authorized to consume another user''s usage';
  END IF;

  IF _daily_cap = -1 THEN
    INSERT INTO public.studio_ai_usage (user_id, usage_date, generation_count)
    VALUES (_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET generation_count = studio_ai_usage.generation_count + 1, updated_at = now()
    RETURNING generation_count INTO v_count;
    RETURN QUERY SELECT true, v_count, -1;
    RETURN;
  END IF;

  IF _daily_cap IS NULL OR _daily_cap <= 0 THEN
    SELECT generation_count INTO v_count FROM public.studio_ai_usage WHERE user_id = _user_id AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.studio_ai_usage (user_id, usage_date, generation_count)
  VALUES (_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET generation_count = studio_ai_usage.generation_count + 1, updated_at = now()
  WHERE studio_ai_usage.generation_count < _daily_cap
  RETURNING generation_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT generation_count INTO v_count FROM public.studio_ai_usage WHERE user_id = _user_id AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;

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

  IF _daily_cap IS NULL OR _daily_cap <= 0 THEN
    SELECT call_count INTO v_count FROM public.ai_feature_usage
    WHERE user_id = _user_id AND feature_key = _feature_key AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.ai_feature_usage (user_id, feature_key, usage_date, call_count)
  VALUES (_user_id, _feature_key, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature_key, usage_date)
  DO UPDATE SET call_count = ai_feature_usage.call_count + 1, updated_at = now()
  WHERE ai_feature_usage.call_count < _daily_cap
  RETURNING call_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT call_count INTO v_count FROM public.ai_feature_usage
    WHERE user_id = _user_id AND feature_key = _feature_key AND usage_date = CURRENT_DATE;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), _daily_cap;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count, _daily_cap;
END;
$$;
