-- Daily session ping table (one row per user per UTC day)
CREATE TABLE IF NOT EXISTS public.user_session_pings (
  user_id UUID NOT NULL,
  ping_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  first_ping_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ping_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, ping_date)
);

CREATE INDEX IF NOT EXISTS idx_user_session_pings_date ON public.user_session_pings (ping_date);
CREATE INDEX IF NOT EXISTS idx_user_session_pings_user ON public.user_session_pings (user_id);

ALTER TABLE public.user_session_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own pings" ON public.user_session_pings;
CREATE POLICY "users read own pings" ON public.user_session_pings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own pings" ON public.user_session_pings;
CREATE POLICY "users insert own pings" ON public.user_session_pings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own pings" ON public.user_session_pings;
CREATE POLICY "users update own pings" ON public.user_session_pings
  FOR UPDATE USING (auth.uid() = user_id);

-- Idempotent ping RPC
CREATE OR REPLACE FUNCTION public.record_session_ping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_session_pings (user_id, ping_date, first_ping_at, last_ping_at, ping_count)
  VALUES (v_user, v_today, now(), now(), 1)
  ON CONFLICT (user_id, ping_date)
  DO UPDATE SET last_ping_at = now(), ping_count = public.user_session_pings.ping_count + 1;

  UPDATE public.profiles
  SET last_active_date = v_today
  WHERE user_id = v_user
    AND (last_active_date IS NULL OR last_active_date < v_today);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_session_ping() TO authenticated;