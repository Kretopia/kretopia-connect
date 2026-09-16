
-- Fix 1: Match notification trigger - link to /messages?user={matched_user_id}
CREATE OR REPLACE FUNCTION public.notify_on_match_with_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
  user1_email TEXT;
  user2_email TEXT;
  supabase_url TEXT := 'https://kwmcocsitwssrtzkdojh.supabase.co';
  service_key TEXT;
BEGIN
  SELECT p.full_name, u.email INTO user1_name, user1_email 
  FROM profiles p 
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = NEW.user1_id;
  
  SELECT p.full_name, u.email INTO user2_name, user2_email 
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id  
  WHERE p.user_id = NEW.user2_id;
  
  -- Notify user1 → link to conversation with user2
  PERFORM create_notification(
    NEW.user1_id,
    'New Match! 🎉',
    'You matched with ' || COALESCE(user2_name, 'someone'),
    'match',
    '/messages?user=' || NEW.user2_id::text,
    '/messages?user=' || NEW.user2_id::text,
    'Send Message',
    NULL,
    'high',
    'match'
  );
  
  -- Notify user2 → link to conversation with user1
  PERFORM create_notification(
    NEW.user2_id,
    'New Match! 🎉',
    'You matched with ' || COALESCE(user1_name, 'someone'),
    'match',
    '/messages?user=' || NEW.user1_id::text,
    '/messages?user=' || NEW.user1_id::text,
    'Send Message',
    NULL,
    'high',
    'match'
  );
  
  -- Try to send emails
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
    
    IF service_key IS NOT NULL AND service_key != '' THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'to', user1_email,
          'type', 'match',
          'data', jsonb_build_object(
            'userName', user1_name,
            'matchName', user2_name
          )
        )
      );
      
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'to', user2_email,
          'type', 'match',
          'data', jsonb_build_object(
            'userName', user2_name,
            'matchName', user1_name
          )
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send match notification emails: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Fix 2: Replace the wrong message trigger function with the correct one
CREATE OR REPLACE FUNCTION public.notify_on_message()
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

-- Fix 3: Clean up existing broken notification links
-- Fix match notifications that point to /circle or /messages (without user param)
UPDATE notifications
SET link = '/messages?user=' || 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM matches m 
      WHERE (m.user1_id = notifications.user_id OR m.user2_id = notifications.user_id)
      AND notifications.message LIKE '%' || (SELECT full_name FROM profiles WHERE user_id = 
        CASE WHEN m.user1_id = notifications.user_id THEN m.user2_id ELSE m.user1_id END
      ) || '%'
    ) THEN (
      SELECT CASE WHEN m.user1_id = notifications.user_id THEN m.user2_id::text ELSE m.user1_id::text END
      FROM matches m
      WHERE (m.user1_id = notifications.user_id OR m.user2_id = notifications.user_id)
      AND notifications.message LIKE '%' || (SELECT full_name FROM profiles WHERE user_id = 
        CASE WHEN m.user1_id = notifications.user_id THEN m.user2_id ELSE m.user1_id END
      ) || '%'
      LIMIT 1
    )
    ELSE ''
  END,
  action_url = link
WHERE type = 'match' AND (link = '/messages' OR link = '/circle?tab=network' OR link LIKE '/circle%')
AND link NOT LIKE '/messages?user=%';

-- Fix message notifications that point to /circle
UPDATE notifications
SET link = '/messages',
    action_url = '/messages'
WHERE type = 'message' AND link = '/circle';
