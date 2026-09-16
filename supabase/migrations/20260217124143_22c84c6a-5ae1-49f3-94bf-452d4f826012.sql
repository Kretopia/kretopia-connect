
-- 1. Add arena ranking fields to challenge_leaderboard
ALTER TABLE public.challenge_leaderboard
ADD COLUMN IF NOT EXISTS arena_rank TEXT NOT NULL DEFAULT 'rookie',
ADD COLUMN IF NOT EXISTS total_entries INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS top_10_finishes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS all_star_finishes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gurus_pick_count INTEGER NOT NULL DEFAULT 0;

-- 2. Add flash cadence and swap support to challenges
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS is_flash BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_swap BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS max_swaps INTEGER NOT NULL DEFAULT 3;

-- 3. Track swaps per entry per user
CREATE TABLE IF NOT EXISTS public.challenge_entry_swaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_entry_id UUID NOT NULL REFERENCES public.challenge_entries(id) ON DELETE CASCADE,
  new_entry_id UUID REFERENCES public.challenge_entries(id) ON DELETE SET NULL,
  swapped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_entry_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own swaps"
  ON public.challenge_entry_swaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own swaps"
  ON public.challenge_entry_swaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Achievement tiers per challenge result
CREATE TABLE IF NOT EXISTS public.challenge_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES public.challenge_entries(id) ON DELETE CASCADE,
  achievement_tier TEXT NOT NULL, -- 'winner', 'top_10', 'all_star', 'gurus_pick'
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE(challenge_id, user_id, achievement_tier)
);

ALTER TABLE public.challenge_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON public.challenge_achievements FOR SELECT
  USING (true);

CREATE POLICY "Only system inserts achievements"
  ON public.challenge_achievements FOR INSERT
  WITH CHECK (false); -- Only edge functions with service role can insert

-- 5. Function to calculate arena rank from stats
CREATE OR REPLACE FUNCTION public.calculate_arena_rank(
  p_total_entries INTEGER,
  p_total_wins INTEGER,
  p_top_10_finishes INTEGER,
  p_all_star_finishes INTEGER
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Elite: 20+ wins OR 50+ all-star finishes
  IF p_total_wins >= 20 OR p_all_star_finishes >= 50 THEN RETURN 'guru'; END IF;
  -- Master: 10+ wins OR 30+ all-star finishes
  IF p_total_wins >= 10 OR p_all_star_finishes >= 30 THEN RETURN 'master'; END IF;
  -- Champion: 5+ wins OR 15+ all-star finishes
  IF p_total_wins >= 5 OR p_all_star_finishes >= 15 THEN RETURN 'champion'; END IF;
  -- Veteran: 3+ wins OR 10+ top-10 finishes
  IF p_total_wins >= 3 OR p_top_10_finishes >= 10 THEN RETURN 'veteran'; END IF;
  -- Challenger: 1+ win OR 5+ top-10 finishes
  IF p_total_wins >= 1 OR p_top_10_finishes >= 5 THEN RETURN 'challenger'; END IF;
  -- Contender: 10+ entries
  IF p_total_entries >= 10 THEN RETURN 'contender'; END IF;
  -- Enthusiast: 3+ entries
  IF p_total_entries >= 3 THEN RETURN 'enthusiast'; END IF;
  -- Default
  RETURN 'rookie';
END;
$$;

-- 6. Trigger to auto-update arena rank when leaderboard changes
CREATE OR REPLACE FUNCTION public.update_arena_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.arena_rank := calculate_arena_rank(
    NEW.total_entries,
    NEW.total_wins,
    NEW.top_10_finishes,
    NEW.all_star_finishes
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_arena_rank ON public.challenge_leaderboard;
CREATE TRIGGER trg_update_arena_rank
  BEFORE INSERT OR UPDATE ON public.challenge_leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION public.update_arena_rank();

-- 7. Increment total_entries when a new challenge entry is created
CREATE OR REPLACE FUNCTION public.increment_leaderboard_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO challenge_leaderboard (user_id, total_entries)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET total_entries = challenge_leaderboard.total_entries + 1,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_leaderboard_entries ON public.challenge_entries;
CREATE TRIGGER trg_increment_leaderboard_entries
  AFTER INSERT ON public.challenge_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_leaderboard_entries();
