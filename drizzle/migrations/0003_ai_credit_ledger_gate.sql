-- AI credit control: one gate, one ledger.
-- Per-user per-feature daily allowance + global daily credit envelope.
-- Every model call must reserve before the call and release on failure/abort.
-- All writes go through security-definer RPCs; clients have no table access.

CREATE TABLE public.ai_credit_ledger (
  user_id uuid NOT NULL,
  feature text NOT NULL,
  window_key text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  cap integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  credits_used numeric(14,6) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, window_key)
);

CREATE TABLE public.ai_credit_envelope (
  day text PRIMARY KEY,
  credits_used numeric(14,6) NOT NULL DEFAULT 0,
  credits_cap numeric(14,6) NOT NULL,
  credits_reserved numeric(14,6) NOT NULL DEFAULT 0,
  denials_allowance integer NOT NULL DEFAULT 0,
  denials_budget integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Single config location for every limit. Changeable without touching code.
-- The special row '__envelope__' carries the global daily credits cap in est_credits.
CREATE TABLE public.ai_credit_config (
  feature text PRIMARY KEY,
  daily_allowance integer NOT NULL DEFAULT 0,
  est_credits numeric(14,6) NOT NULL DEFAULT 0,
  max_output_tokens integer,
  model text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_credit_ledger TO service_role;
GRANT ALL ON public.ai_credit_envelope TO service_role;
GRANT ALL ON public.ai_credit_config TO service_role;
GRANT SELECT ON public.ai_credit_config TO authenticated;

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_envelope ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_config ENABLE ROW LEVEL SECURITY;

-- No policies on ledger/envelope: RLS denies every client read and write.
-- Config is readable by signed-in users so the quota indicator can show limits.
CREATE POLICY "authenticated read config" ON public.ai_credit_config
  FOR SELECT TO authenticated USING (true);

-- Seed defaults. Envelope cap = measured peak daily spend (0.167 credits on 2026-10-27),
-- not a round number. Allowances are per-user; the envelope is the hard global stop.
INSERT INTO public.ai_credit_config (feature, daily_allowance, est_credits, max_output_tokens, model) VALUES
  ('__envelope__',       0,     0.167,    NULL, NULL),
  ('kreto_message',      30,    0.006,    800,  NULL),
  ('kreto_tokens',       60000, 0,        NULL, NULL),
  ('kreto_autocomplete', 200,   0.0004,   24,   'google/gemini-2.5-flash-lite'),
  ('match_generation',   1,     0.02,     1200, NULL),
  ('scout_scan',         1,     0.05,     2000, NULL),
  ('attachment_parse',   10,    0.003,    512,  NULL);

-- Reserve units before a model call. Envelope first, then personal allowance.
-- Returns allowed + reason code ('allowance' | 'budget') so denials are
-- distinguishable in logs and in the UI.
CREATE OR REPLACE FUNCTION public.try_reserve_ai_credit(
  _user_id uuid,
  _feature text,
  _units integer,
  _est_credits numeric DEFAULT NULL
)
RETURNS TABLE(allowed boolean, reason text, used integer, cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_key text := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  cfg public.ai_credit_config%ROWTYPE;
  env_cap numeric;
  est numeric;
  env_ok boolean;
BEGIN
  SELECT * INTO cfg FROM public.ai_credit_config WHERE feature = _feature;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'allowance'::text, 0, 0;
    RETURN;
  END IF;
  est := COALESCE(_est_credits, cfg.est_credits, 0);

  SELECT c.est_credits INTO env_cap FROM public.ai_credit_config c WHERE c.feature = '__envelope__';
  env_cap := COALESCE(env_cap, 0);

  -- 1) Global envelope: atomic check + reserve.
  INSERT INTO public.ai_credit_envelope AS e (day, credits_used, credits_cap, credits_reserved)
  VALUES (day_key, 0, env_cap, est)
  ON CONFLICT (day) DO UPDATE
    SET credits_reserved = e.credits_reserved + est, updated_at = now()
    WHERE e.credits_used + e.credits_reserved + est <= e.credits_cap;
  GET DIAGNOSTICS env_ok = ROW_COUNT;
  IF NOT env_ok THEN
    INSERT INTO public.ai_credit_envelope AS e (day, credits_used, credits_cap, denials_budget)
    VALUES (day_key, 0, env_cap, 1)
    ON CONFLICT (day) DO UPDATE
      SET denials_budget = e.denials_budget + 1, updated_at = now();
    RETURN QUERY SELECT false, 'budget'::text, 0, 0;
    RETURN;
  END IF;

  -- 2) Personal allowance: atomic check + reserve (cap < 0 = unlimited).
  INSERT INTO public.ai_credit_ledger AS l (user_id, feature, window_key, used, cap, reserved)
  VALUES (_user_id, _feature, day_key, 0, cfg.daily_allowance, _units)
  ON CONFLICT (user_id, feature, window_key) DO UPDATE
    SET reserved = l.reserved + EXCLUDED.reserved, updated_at = now()
    WHERE l.cap < 0 OR l.used + l.reserved + EXCLUDED.reserved <= l.cap;
  IF NOT FOUND THEN
    -- Roll back the envelope reservation, count the denial.
    UPDATE public.ai_credit_envelope
      SET credits_reserved = GREATEST(0, credits_reserved - est),
          denials_allowance = denials_allowance + 1,
          updated_at = now()
      WHERE day = day_key;
    RETURN QUERY
      SELECT false, 'allowance'::text,
             COALESCE((SELECT l2.used FROM public.ai_credit_ledger l2
                        WHERE l2.user_id = _user_id AND l2.feature = _feature AND l2.window_key = day_key), 0),
             cfg.daily_allowance;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT true, NULL::text,
           (SELECT l3.used FROM public.ai_credit_ledger l3
             WHERE l3.user_id = _user_id AND l3.feature = _feature AND l3.window_key = day_key),
           cfg.daily_allowance;
END;
$function$;

-- Convert a reservation into usage after a successful call.
-- _credits is the actual measured cost when known, else the estimate.
CREATE OR REPLACE FUNCTION public.commit_ai_credit(
  _user_id uuid,
  _feature text,
  _units integer,
  _credits numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_key text := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  est numeric;
BEGIN
  SELECT COALESCE(c.est_credits, 0) INTO est FROM public.ai_credit_config c WHERE c.feature = _feature;
  est := COALESCE(est, 0);

  UPDATE public.ai_credit_ledger
    SET reserved = GREATEST(0, reserved - _units),
        used = used + _units,
        credits_used = credits_used + COALESCE(_credits, est),
        updated_at = now()
    WHERE user_id = _user_id AND feature = _feature AND window_key = day_key;

  UPDATE public.ai_credit_envelope
    SET credits_reserved = GREATEST(0, credits_reserved - est),
        credits_used = credits_used + COALESCE(_credits, est),
        updated_at = now()
    WHERE day = day_key;
END;
$function$;

-- Release a reservation when the call fails or is aborted.
CREATE OR REPLACE FUNCTION public.release_ai_credit(
  _user_id uuid,
  _feature text,
  _units integer,
  _est_credits numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_key text := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  est numeric;
BEGIN
  SELECT COALESCE(c.est_credits, 0) INTO est FROM public.ai_credit_config c WHERE c.feature = _feature;
  est := COALESCE(_est_credits, est, 0);

  UPDATE public.ai_credit_ledger
    SET reserved = GREATEST(0, reserved - _units), updated_at = now()
    WHERE user_id = _user_id AND feature = _feature AND window_key = day_key;

  UPDATE public.ai_credit_envelope
    SET credits_reserved = GREATEST(0, credits_reserved - est), updated_at = now()
    WHERE day = day_key;
END;
$function$;

-- Read-only overview for the quota indicator and the admin view:
-- envelope today + per-feature totals today + the caller's own usage.
CREATE OR REPLACE FUNCTION public.get_ai_credit_overview(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_key text := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  env jsonb;
  per_feature jsonb;
  mine jsonb;
BEGIN
  SELECT jsonb_build_object(
    'day', e.day,
    'credits_used', e.credits_used,
    'credits_cap', e.credits_cap,
    'credits_reserved', e.credits_reserved,
    'denials_allowance', e.denials_allowance,
    'denials_budget', e.denials_budget
  ) INTO env FROM public.ai_credit_envelope e WHERE e.day = day_key;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'feature', l.feature,
    'used', l.total_used,
    'reserved', l.total_reserved,
    'credits_used', l.total_credits
  ) ORDER BY l.feature), '[]'::jsonb) INTO per_feature
  FROM (
    SELECT feature, sum(used) AS total_used, sum(reserved) AS total_reserved, sum(credits_used) AS total_credits
    FROM public.ai_credit_ledger WHERE window_key = day_key GROUP BY feature
  ) l;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'feature', l.feature,
    'used', l.used,
    'cap', l.cap,
    'reserved', l.reserved
  ) ORDER BY l.feature), '[]'::jsonb) INTO mine
  FROM public.ai_credit_ledger l
  WHERE _user_id IS NOT NULL AND l.user_id = _user_id AND l.window_key = day_key;

  RETURN jsonb_build_object(
    'envelope', COALESCE(env, jsonb_build_object('day', day_key, 'credits_used', 0, 'credits_cap',
      COALESCE((SELECT c.est_credits FROM public.ai_credit_config c WHERE c.feature = '__envelope__'), 0),
      'credits_reserved', 0, 'denials_allowance', 0, 'denials_budget', 0)),
    'features', per_feature,
    'mine', mine
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.try_reserve_ai_credit(uuid, text, integer, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_ai_credit(uuid, text, integer, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_credit(uuid, text, integer, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_overview(uuid) TO service_role;