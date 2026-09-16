
-- Remove redundant notification triggers (keeping only notify_on_match_with_email via on_match_created)
DROP TRIGGER IF EXISTS notify_match_trigger ON public.matches;
DROP TRIGGER IF EXISTS notify_on_match_trigger ON public.matches;

-- Keep only one trigger
DROP TRIGGER IF EXISTS on_match_created ON public.matches;
CREATE TRIGGER on_match_created
AFTER INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_match_with_email();

-- Clean up duplicate notifications (keep only the first one per match per user)
DELETE FROM notifications n1
USING notifications n2
WHERE n1.id > n2.id
  AND n1.user_id = n2.user_id
  AND n1.type = n2.type
  AND n1.message = n2.message
  AND n1.type = 'match'
  AND n1.created_at::date = n2.created_at::date;
