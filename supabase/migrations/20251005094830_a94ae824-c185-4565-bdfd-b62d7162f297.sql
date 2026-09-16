-- Drop the problematic triggers that use net.http_post
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

-- Recreate send_welcome_email function without net dependency (just skip email for now)
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- Welcome email functionality disabled until pg_net is configured
  -- Just return the new row to allow user creation to proceed
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email();

-- Also fix the match notification function
CREATE OR REPLACE FUNCTION public.notify_on_match_with_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
BEGIN
  -- Get user names
  SELECT full_name INTO user1_name FROM profiles WHERE user_id = NEW.user1_id;
  SELECT full_name INTO user2_name FROM profiles WHERE user_id = NEW.user2_id;
  
  -- Create in-app notifications only (email disabled until pg_net is configured)
  PERFORM create_notification(
    NEW.user1_id,
    'New Match! 🎉',
    'You matched with ' || user2_name,
    'match',
    '/circle',
    '/circle',
    'View Connection',
    NULL,
    'high',
    'match'
  );
  
  PERFORM create_notification(
    NEW.user2_id,
    'New Match! 🎉',
    'You matched with ' || user1_name,
    'match',
    '/circle',
    '/circle',
    'View Connection',
    NULL,
    'high',
    'match'
  );
  
  RETURN NEW;
END;
$$;