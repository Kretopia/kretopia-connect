-- Create challenges table
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('platform', 'brand')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'voting', 'completed', 'cancelled')),
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  prize_description TEXT,
  prize_amount NUMERIC,
  budget TEXT,
  thumbnail_url TEXT,
  requirements TEXT,
  tags TEXT[] DEFAULT '{}',
  max_entries INTEGER,
  voting_ends_at TIMESTAMP WITH TIME ZONE,
  brand_name TEXT,
  brand_logo_url TEXT
);

-- Create challenge_entries table
CREATE TABLE public.challenge_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  thumbnail_url TEXT,
  vote_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'winner')),
  UNIQUE(challenge_id, user_id)
);

-- Create challenge_votes table
CREATE TABLE public.challenge_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.challenge_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entry_id, user_id)
);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenges
CREATE POLICY "Anyone can view active challenges"
  ON public.challenges FOR SELECT
  USING (status IN ('active', 'voting', 'completed'));

CREATE POLICY "Users can create challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own challenges"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = created_by);

-- RLS Policies for challenge_entries
CREATE POLICY "Anyone can view approved entries"
  ON public.challenge_entries FOR SELECT
  USING (status IN ('approved', 'winner'));

CREATE POLICY "Users can view own entries"
  ON public.challenge_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create entries"
  ON public.challenge_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON public.challenge_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Challenge creators can update entries"
  ON public.challenge_entries FOR UPDATE
  USING (auth.uid() IN (
    SELECT created_by FROM challenges WHERE id = challenge_entries.challenge_id
  ));

-- RLS Policies for challenge_votes
CREATE POLICY "Anyone can view votes"
  ON public.challenge_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can create votes"
  ON public.challenge_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.challenge_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_challenges_status ON public.challenges(status);
CREATE INDEX idx_challenges_deadline ON public.challenges(deadline);
CREATE INDEX idx_challenge_entries_challenge_id ON public.challenge_entries(challenge_id);
CREATE INDEX idx_challenge_entries_user_id ON public.challenge_entries(user_id);
CREATE INDEX idx_challenge_votes_entry_id ON public.challenge_votes(entry_id);
CREATE INDEX idx_challenge_votes_user_id ON public.challenge_votes(user_id);

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_entry_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenge_entries 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenge_entries 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update vote counts
CREATE TRIGGER update_vote_count_trigger
AFTER INSERT OR DELETE ON public.challenge_votes
FOR EACH ROW EXECUTE FUNCTION update_entry_vote_count();