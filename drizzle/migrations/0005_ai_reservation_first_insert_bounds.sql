CREATE OR REPLACE FUNCTION public.try_reserve_ai_credit(_user_id uuid, _feature text, _units integer, _est_credits numeric DEFAULT NULL)
RETURNS TABLE(allowed boolean, reason text, used integer, cap integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
 day_key text := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
 cfg public.ai_credit_config%ROWTYPE;
 env_cap numeric;
 est numeric;
 env_ok integer;
BEGIN
 SELECT * INTO cfg FROM public.ai_credit_config WHERE feature = _feature;
 IF NOT FOUND OR _user_id IS NULL OR _units <= 0 THEN RETURN QUERY SELECT false, 'allowance'::text, 0, 0; RETURN; END IF;
 est := COALESCE(_est_credits, cfg.est_credits, 0);
 IF est < 0 THEN RETURN QUERY SELECT false, 'budget'::text, 0, 0; RETURN; END IF;
 SELECT c.est_credits INTO env_cap FROM public.ai_credit_config c WHERE c.feature = '__envelope__';
 env_cap := COALESCE(env_cap, 0);
 INSERT INTO public.ai_credit_envelope AS e(day, credits_used, credits_cap, credits_reserved)
 VALUES(day_key, 0, env_cap, 0) ON CONFLICT(day) DO NOTHING;
 UPDATE public.ai_credit_envelope AS e SET credits_reserved = e.credits_reserved + est, updated_at = now()
 WHERE e.day = day_key AND e.credits_used + e.credits_reserved + est <= e.credits_cap;
 GET DIAGNOSTICS env_ok = ROW_COUNT;
 IF env_ok = 0 THEN
  UPDATE public.ai_credit_envelope SET denials_budget = denials_budget + 1 WHERE day = day_key;
  RETURN QUERY SELECT false, 'budget'::text, 0, 0; RETURN;
 END IF;
 INSERT INTO public.ai_credit_ledger(user_id, feature, window_key, used, cap, reserved)
 VALUES(_user_id, _feature, day_key, 0, cfg.daily_allowance, 0) ON CONFLICT(user_id, feature, window_key) DO NOTHING;
 UPDATE public.ai_credit_ledger AS l SET reserved = l.reserved + _units, updated_at = now()
 WHERE l.user_id = _user_id AND l.feature = _feature AND l.window_key = day_key AND (l.cap < 0 OR l.used + l.reserved + _units <= l.cap);
 IF NOT FOUND THEN
  UPDATE public.ai_credit_envelope SET credits_reserved = GREATEST(0, credits_reserved - est), denials_allowance = denials_allowance + 1 WHERE day = day_key;
  RETURN QUERY SELECT false, 'allowance'::text, l.used, l.cap FROM public.ai_credit_ledger l WHERE l.user_id = _user_id AND l.feature = _feature AND l.window_key = day_key;
  RETURN;
 END IF;
 RETURN QUERY SELECT true, NULL::text, l.used, l.cap FROM public.ai_credit_ledger l WHERE l.user_id = _user_id AND l.feature = _feature AND l.window_key = day_key;
END;
$function$;
REVOKE ALL ON FUNCTION public.try_reserve_ai_credit(uuid,text,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_reserve_ai_credit(uuid,text,integer,numeric) TO service_role;