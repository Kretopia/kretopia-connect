-- Create trigger to notify users when they match
CREATE TRIGGER on_match_created
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_match_with_email();