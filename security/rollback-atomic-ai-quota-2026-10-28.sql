-- ROLLBACK: atomic daily AI quota. Restores the three functions exactly as the repo defined them before
-- 20261028120000_atomic_ai_quota_consume.sql (read-then-increment). Paste into the SQL editor of the production
-- database and run once. Grants are untouched (CREATE OR REPLACE keeps them: service_role only).
-- Sources: 20260910180000_close_ai_usage_counter_bypass.sql (copilot, studio) and
-- 20261006160000_create_ai_rate_limit_table.sql (feature).
-- Only use it if the new functions misbehave: the old ones let parallel calls pass a cap.

BEGIN;

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

  SELECT message_count INTO v_count
  FROM public.desk_ai_usage
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= _daily_cap THEN
    RETURN QUERY SELECT false, v_count, _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.desk_ai_usage (user_id, usage_date, message_count)
  VALUES (_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = desk_ai_usage.message_count + 1, updated_at = now()
  RETURNING message_count INTO v_count;

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

  SELECT generation_count INTO v_count
  FROM public.studio_ai_usage
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= _daily_cap THEN
    RETURN QUERY SELECT false, v_count, _daily_cap;
    RETURN;
  END IF;

  INSERT INTO public.studio_ai_usage (user_id, usage_date, generation_count)
  VALUES (_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET generation_count = studio_ai_usage.generation_count + 1, updated_at = now()
  RETURNING generation_count INTO v_count;

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

COMMIT;

-- Check (read-only): expect 3 rows with has_read_then_check = true after a rollback.
SELECT p.proname, p.prosrc ILIKE '%>= _daily_cap%' AS has_read_then_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('consume_copilot_message', 'consume_studio_ai_generation', 'consume_ai_feature_call')
ORDER BY p.proname;
