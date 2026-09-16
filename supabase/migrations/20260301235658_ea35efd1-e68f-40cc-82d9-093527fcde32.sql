
-- =============================================
-- PHASE 1: Foundation for Spark + Cre8
-- =============================================

-- 1. Spark Rooms
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active rooms"
  ON public.spark_rooms FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Authenticated users can create rooms"
  ON public.spark_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms"
  ON public.spark_rooms FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Room creators can delete their rooms"
  ON public.spark_rooms FOR DELETE
  USING (auth.uid() = created_by);

-- 2. Spark Room Messages
CREATE TABLE public.spark_room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view messages"
  ON public.spark_room_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can post messages"
  ON public.spark_room_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.spark_room_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for room messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.spark_room_messages;

-- 3. Spark Room Members (track who joined which room)
CREATE TABLE public.spark_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.spark_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view room members"
  ON public.spark_room_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join rooms"
  ON public.spark_room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON public.spark_room_members FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Challenges table
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  cadence TEXT NOT NULL DEFAULT 'weekly',
  cover_image_url TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  entry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view challenges"
  ON public.challenges FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their challenges"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = created_by);

-- 5. Challenge Entries
CREATE TABLE public.challenge_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view entries"
  ON public.challenge_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can submit entries"
  ON public.challenge_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their entries"
  ON public.challenge_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Challenge Votes
CREATE TABLE public.challenge_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.challenge_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entry_id, user_id)
);

ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view votes"
  ON public.challenge_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can vote"
  ON public.challenge_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their vote"
  ON public.challenge_votes FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Challenge Leaderboard (materialized stats)
CREATE TABLE public.challenge_leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_votes_received INTEGER NOT NULL DEFAULT 0,
  total_challenge_xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view leaderboard"
  ON public.challenge_leaderboard FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 8. Triggers for room member/message counts
CREATE OR REPLACE FUNCTION public.update_spark_room_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE spark_rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE spark_rooms SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_spark_room_member_count
AFTER INSERT OR DELETE ON public.spark_room_members
FOR EACH ROW EXECUTE FUNCTION public.update_spark_room_member_count();

CREATE OR REPLACE FUNCTION public.update_spark_room_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE TRIGGER trg_update_spark_room_message_count
AFTER INSERT OR DELETE ON public.spark_room_messages
FOR EACH ROW EXECUTE FUNCTION public.update_spark_room_message_count();

-- 9. Trigger: update vote count on challenge entries
CREATE OR REPLACE FUNCTION public.update_challenge_entry_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenge_entries SET vote_count = vote_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenge_entries SET vote_count = GREATEST(0, vote_count - 1) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_challenge_entry_vote_count
AFTER INSERT OR DELETE ON public.challenge_votes
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_entry_vote_count();

-- 10. Updated_at triggers
CREATE TRIGGER update_spark_rooms_updated_at
BEFORE UPDATE ON public.spark_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
