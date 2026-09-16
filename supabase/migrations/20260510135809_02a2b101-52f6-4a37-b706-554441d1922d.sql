CREATE OR REPLACE FUNCTION public.consume_voice_seconds(_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHEN _tier IN ('founder','founder_circle','founding_member','brand_enterprise') THEN -1
    WHEN _tier IN ('creator_pro','creator+','enterprise') THEN 36000
    WHEN _tier IN ('pro','creator','brand_pro') THEN 7200
    ELSE 900
  END;

  SELECT seconds_used INTO _used FROM public.voice_usage_daily
   WHERE user_id = _uid AND day = _today;
  _used := COALESCE(_used, 0);

  IF _cap >= 0 AND _used + _seconds > _cap THEN
    RETURN jsonb_build_object('ok', false, 'error', 'voice_daily_limit', 'used', _used, 'cap', _cap, 'tier', _tier);
  END IF;

  INSERT INTO public.voice_usage_daily(user_id, day, seconds_used, turns_used)
  VALUES (_uid, _today, _seconds, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET seconds_used = voice_usage_daily.seconds_used + EXCLUDED.seconds_used,
        turns_used = voice_usage_daily.turns_used + 1,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'used', _used + _seconds, 'cap', _cap, 'tier', _tier);
END;
$function$;