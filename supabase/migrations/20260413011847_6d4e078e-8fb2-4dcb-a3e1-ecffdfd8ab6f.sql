
-- Fix message notification trigger to link to /messages?user={sender_id} instead of /circle
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  IF NEW.receiver_id IS NOT NULL THEN
    SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
    
    PERFORM public.create_notification(
      NEW.receiver_id,
      'New Message',
      COALESCE(sender_name, 'Someone') || ' sent you a message',
      'message',
      '/messages?user=' || NEW.sender_id::text,
      '/messages?user=' || NEW.sender_id::text,
      'View Message',
      NULL,
      'normal',
      'message'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix match notification trigger to link to /messages?user={other_id} instead of /circle
CREATE OR REPLACE FUNCTION public.notify_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
BEGIN
  SELECT full_name INTO user1_name FROM public.profiles WHERE user_id = NEW.user1_id;
  SELECT full_name INTO user2_name FROM public.profiles WHERE user_id = NEW.user2_id;
  
  PERFORM create_notification(
    NEW.user1_id,
    'New Match! 🎉',
    'You matched with ' || COALESCE(user2_name, 'a creator') || '!',
    'match',
    '/messages?user=' || NEW.user2_id::text,
    '/messages?user=' || NEW.user2_id::text,
    'Send Message',
    NULL,
    'high',
    'match'
  );
  
  PERFORM create_notification(
    NEW.user2_id,
    'New Match! 🎉',
    'You matched with ' || COALESCE(user1_name, 'a creator') || '!',
    'match',
    '/messages?user=' || NEW.user1_id::text,
    '/messages?user=' || NEW.user1_id::text,
    'Send Message',
    NULL,
    'high',
    'match'
  );
  
  RETURN NEW;
END;
$$;

-- Also fix existing broken notifications that point to /circle for messages
UPDATE public.notifications 
SET link = '/messages', action_url = '/messages'
WHERE category = 'message' AND (link = '/circle' OR action_url = '/circle');

-- Fix match notifications pointing to /circle?tab=network
UPDATE public.notifications 
SET link = '/messages', action_url = '/messages'
WHERE type = 'match' AND (link = '/circle?tab=network' OR action_url = '/circle?tab=network');
