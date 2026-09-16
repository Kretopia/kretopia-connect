
-- Auto-increment entry_count via trigger instead of client-side update
CREATE OR REPLACE FUNCTION public.update_challenge_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenges SET entry_count = entry_count + 1 WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenges SET entry_count = GREATEST(entry_count - 1, 0) WHERE id = OLD.challenge_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_challenge_entry_count ON public.challenge_entries;
CREATE TRIGGER trg_update_challenge_entry_count
  AFTER INSERT OR DELETE ON public.challenge_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_challenge_entry_count();

-- Also auto-increment vote_count via trigger
CREATE OR REPLACE FUNCTION public.update_entry_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenge_entries SET vote_count = vote_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenge_entries SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_entry_vote_count ON public.challenge_votes;
CREATE TRIGGER trg_update_entry_vote_count
  AFTER INSERT OR DELETE ON public.challenge_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_entry_vote_count();
