
-- =============================================
-- Phase 1: Spark + Cre8 Foundation Tables
-- =============================================

-- 1. Feed Clips (bookmark/save system for Spark)
CREATE TABLE public.feed_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.feed_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clips"
  ON public.feed_clips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clips"
  ON public.feed_clips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clips"
  ON public.feed_clips FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Spark Rooms (conversation threads)
CREATE TABLE public.spark_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  member_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rooms"
  ON public.spark_rooms FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can create rooms"
  ON public.spark_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms"
  ON public.spark_rooms FOR UPDATE
  USING (auth.uid() = created_by);

-- 3. Spark Room Messages
CREATE TABLE public.spark_room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view room messages"
  ON public.spark_room_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can post messages"
  ON public.spark_room_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.spark_room_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update room message_count
CREATE OR REPLACE FUNCTION public.update_room_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE spark_rooms SET message_count = message_count + 1 WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE spark_rooms SET message_count = GREATEST(0, message_count - 1) WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_room_message_change
  AFTER INSERT OR DELETE ON public.spark_room_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_room_message_count();

-- Enable realtime for room messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.spark_room_messages;

-- 4. Extend challenges table with cadence and xp_reward
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS xp_reward INTEGER NOT NULL DEFAULT 100;

-- 5. Challenge Leaderboard Stats
CREATE TABLE public.challenge_leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_votes_received INTEGER NOT NULL DEFAULT 0,
  total_challenge_xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard"
  ON public.challenge_leaderboard FOR SELECT
  USING (true);

CREATE POLICY "System updates leaderboard via triggers"
  ON public.challenge_leaderboard FOR ALL
  USING (auth.uid() = user_id);

-- Trigger: update leaderboard stats when a vote is cast
CREATE OR REPLACE FUNCTION public.update_leaderboard_on_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO entry_owner FROM challenge_entries WHERE id = NEW.entry_id;
    
    INSERT INTO challenge_leaderboard (user_id, total_votes_received)
    VALUES (entry_owner, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET total_votes_received = challenge_leaderboard.total_votes_received + 1,
        updated_at = now();
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO entry_owner FROM challenge_entries WHERE id = OLD.entry_id;
    
    UPDATE challenge_leaderboard
    SET total_votes_received = GREATEST(0, total_votes_received - 1),
        updated_at = now()
    WHERE user_id = entry_owner;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_challenge_vote_leaderboard
  AFTER INSERT OR DELETE ON public.challenge_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_leaderboard_on_vote();
