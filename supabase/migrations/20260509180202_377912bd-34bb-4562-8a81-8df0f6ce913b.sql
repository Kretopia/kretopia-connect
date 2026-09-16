
-- Daily voice usage tracking for Thrive Voice
CREATE TABLE IF NOT EXISTS public.voice_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now() at time zone 'utc')::date,
  seconds_used integer NOT NULL DEFAULT 0,
  turns_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_voice_usage_daily_user_day
  ON public.voice_usage_daily(user_id, day);

ALTER TABLE public.voice_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voice usage"
  ON public.voice_usage_daily FOR SELECT
  USING (auth.uid() = user_id);

-- Caps per tier (seconds per day)
-- free=120 (2min), pro/creator=900 (15min), creator_plus=3600 (60min), founder=unlimited(-1)
CREATE OR REPLACE FUNCTION public.consume_voice_seconds(_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tier text;
  _cap integer;
  _today date := (now() at time zone 'utc')::date;
  _used integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(subscription_tier, 'free') INTO _tier
  FROM public.profiles WHERE user_id = _uid;

  _cap := CASE
    WHEN _tier IN ('founder','founder_circle','founding_member') THEN -1
    WHEN _tier IN ('creator_plus','creator+','enterprise') THEN 3600
    WHEN _tier IN ('pro','creator') THEN 900
    ELSE 120
  END;

  SELECT seconds_used INTO _used FROM public.voice_usage_daily
   WHERE user_id = _uid AND day = _today;
  _used := COALESCE(_used, 0);

  IF _cap >= 0 AND _used + _seconds > _cap THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'voice_daily_limit',
      'used', _used, 'cap', _cap, 'tier', _tier
    );
  END IF;

  INSERT INTO public.voice_usage_daily(user_id, day, seconds_used, turns_used)
  VALUES (_uid, _today, _seconds, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET seconds_used = voice_usage_daily.seconds_used + EXCLUDED.seconds_used,
        turns_used = voice_usage_daily.turns_used + 1,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'used', _used + _seconds,
    'cap', _cap,
    'tier', _tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_voice_seconds(integer) TO authenticated;
