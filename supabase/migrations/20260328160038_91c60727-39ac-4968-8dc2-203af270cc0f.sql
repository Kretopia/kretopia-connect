ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin_date date,
  ADD COLUMN IF NOT EXISTS total_xp integer DEFAULT 0;