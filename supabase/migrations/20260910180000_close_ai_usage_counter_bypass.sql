-- Closes two real bypasses of the daily AI usage caps, found while
-- auditing the "bible" AI rate-limit work done earlier in this session.
--
-- 1. Client-writable counters. desk_ai_usage and studio_ai_usage both
--    grant `authenticated` a direct, unrestricted-value INSERT/UPDATE
--    policy ("mirroring desk_ai_usage's equivalent policies" per
--    20260819090000's own comment) alongside the atomic SECURITY DEFINER
--    RPCs (consume_copilot_message / consume_studio_ai_generation) meant
--    to gate them. A client can bypass the RPC entirely with a direct
--    PATCH -- e.g. `PATCH desk_ai_usage?user_id=eq.<self>&usage_date=eq.<today>
--    {"message_count": 0}` -- and reset their own daily counter to zero at
--    will, defeating the cap completely regardless of tier. The RPCs are
--    SECURITY DEFINER, so dropping the client policies does not affect
--    them -- only the redundant direct-write path goes away.
--
-- 2. Missing caller-identity check on the counter RPCs. consume_copilot_message,
--    consume_studio_ai_generation, and this session's own consume_ai_feature_call
--    all take an arbitrary `_user_id` parameter, are SECURITY DEFINER, and
--    are GRANT EXECUTE'd directly to `authenticated` -- but none checks
--    that the caller actually IS `_user_id`. Any authenticated client can
--    call e.g. `rpc('consume_copilot_message', {_user_id: '<other-uuid>', _daily_cap: 5})`
--    and increment/exhaust a different user's counter -- a quota-griefing
--    vector against other users' AI access. Fixed by requiring
--    auth.uid() = _user_id whenever the call carries a real user JWT;
--    calls made via the service-role key (edge functions acting on a
--    caller's behalf, forwarding no per-request Authorization header) have
--    auth.uid() = NULL and are left untouched, since service_role already
--    bypasses RLS everywhere else in this codebase and is the trusted path
--    every real call site actually uses.

DROP POLICY IF EXISTS "Users can insert their own DeskAI usage" ON public.desk_ai_usage;
DROP POLICY IF EXISTS "Users can update their own DeskAI usage" ON public.desk_ai_usage;

DROP POLICY IF EXISTS "Users can insert their own Studio AI usage" ON public.studio_ai_usage;
DROP POLICY IF EXISTS "Users can update their own Studio AI usage" ON public.studio_ai_usage;

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
