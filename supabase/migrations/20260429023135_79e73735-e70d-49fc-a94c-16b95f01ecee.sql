-- Money streak table for ThrivePay daily-driver hook
CREATE TABLE IF NOT EXISTS public.money_streaks (
  user_id UUID PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_action_date DATE,
  last_action_type TEXT,
  total_actions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.money_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own money streak"
  ON public.money_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own money streak"
  ON public.money_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own money streak"
  ON public.money_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_money_streaks_updated_at
  BEFORE UPDATE ON public.money_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: record a money action and update streak
CREATE OR REPLACE FUNCTION public.record_money_action(_action_type TEXT)
RETURNS TABLE (current_streak INTEGER, longest_streak INTEGER, is_new_day BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::DATE;
  _row public.money_streaks%ROWTYPE;
  _new_streak INTEGER;
  _is_new_day BOOLEAN := FALSE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _row FROM public.money_streaks WHERE user_id = _uid;

  IF NOT FOUND THEN
    INSERT INTO public.money_streaks (user_id, current_streak, longest_streak, last_action_date, last_action_type, total_actions)
    VALUES (_uid, 1, 1, _today, _action_type, 1)
    RETURNING money_streaks.current_streak, money_streaks.longest_streak INTO _new_streak, _new_streak;
    RETURN QUERY SELECT 1, 1, TRUE;
    RETURN;
  END IF;

  IF _row.last_action_date = _today THEN
    -- Already logged today, just bump count
    UPDATE public.money_streaks
    SET total_actions = total_actions + 1, last_action_type = _action_type
    WHERE user_id = _uid;
    RETURN QUERY SELECT _row.current_streak, _row.longest_streak, FALSE;
    RETURN;
  END IF;

  IF _row.last_action_date = _today - INTERVAL '1 day' THEN
    _new_streak := _row.current_streak + 1;
  ELSE
    _new_streak := 1;
  END IF;

  _is_new_day := TRUE;

  UPDATE public.money_streaks
  SET current_streak = _new_streak,
      longest_streak = GREATEST(longest_streak, _new_streak),
      last_action_date = _today,
      last_action_type = _action_type,
      total_actions = total_actions + 1
  WHERE user_id = _uid;

  RETURN QUERY SELECT _new_streak, GREATEST(_row.longest_streak, _new_streak), _is_new_day;
END;
$$;