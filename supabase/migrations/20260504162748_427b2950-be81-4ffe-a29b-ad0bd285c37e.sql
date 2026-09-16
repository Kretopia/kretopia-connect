
CREATE TABLE IF NOT EXISTS public.daily_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  streak_type TEXT NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_action_date DATE,
  total_actions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, streak_type)
);

ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own streaks"
  ON public.daily_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own streaks"
  ON public.daily_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own streaks"
  ON public.daily_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_streaks_user ON public.daily_streaks(user_id, streak_type);

CREATE OR REPLACE FUNCTION public.bump_streak(_streak_type TEXT)
RETURNS TABLE (current_streak INT, longest_streak INT, last_action_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := CURRENT_DATE;
  _row public.daily_streaks%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _row FROM public.daily_streaks
   WHERE user_id = _uid AND streak_type = _streak_type;

  IF NOT FOUND THEN
    INSERT INTO public.daily_streaks (user_id, streak_type, current_streak, longest_streak, last_action_date, total_actions)
    VALUES (_uid, _streak_type, 1, 1, _today, 1)
    RETURNING * INTO _row;
  ELSIF _row.last_action_date = _today THEN
    UPDATE public.daily_streaks
       SET total_actions = total_actions + 1, updated_at = now()
     WHERE id = _row.id
     RETURNING * INTO _row;
  ELSIF _row.last_action_date = _today - INTERVAL '1 day' THEN
    UPDATE public.daily_streaks
       SET current_streak = current_streak + 1,
           longest_streak = GREATEST(longest_streak, current_streak + 1),
           last_action_date = _today,
           total_actions = total_actions + 1,
           updated_at = now()
     WHERE id = _row.id
     RETURNING * INTO _row;
  ELSE
    UPDATE public.daily_streaks
       SET current_streak = 1,
           last_action_date = _today,
           total_actions = total_actions + 1,
           updated_at = now()
     WHERE id = _row.id
     RETURNING * INTO _row;
  END IF;

  RETURN QUERY SELECT _row.current_streak, _row.longest_streak, _row.last_action_date;
END;
$$;

CREATE TRIGGER trg_daily_streaks_updated
  BEFORE UPDATE ON public.daily_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
