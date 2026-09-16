
-- Fix match notification function to use correct deep links
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
  -- Get user names and emails
  SELECT p.full_name, u.email INTO user1_name, user1_email 
  FROM profiles p 
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = NEW.user1_id;
  
  SELECT p.full_name, u.email INTO user2_name, user2_email 
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id  
  WHERE p.user_id = NEW.user2_id;
  
  -- Create in-app notifications with correct deep links
  PERFORM create_notification(
    NEW.user1_id,
    'New Match! 🎉',
    'You matched with ' || user2_name,
    'match',
    '/circle?tab=network',
    '/circle?tab=network',
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
    '/circle?tab=network',
    '/circle?tab=network',
    'View Connection',
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

-- Fix existing stale notification links
-- Fix old /thrivedesk/ paths to /desk/
UPDATE notifications SET link = REPLACE(link, '/thrivedesk/', '/desk/') WHERE link LIKE '/thrivedesk/%';
UPDATE notifications SET action_url = REPLACE(action_url, '/thrivedesk/', '/desk/') WHERE action_url LIKE '/thrivedesk/%';

-- Fix project message notifications to include ?tab=messages
UPDATE notifications 
SET link = link || '?tab=messages', 
    action_url = action_url || '?tab=messages',
    action_text = 'View Messages'
WHERE category = 'project' 
  AND type = 'project' 
  AND title LIKE '%message%'
  AND link LIKE '/desk/%' 
  AND link NOT LIKE '%?tab=%';

-- Fix match notifications to use ?tab=network
UPDATE notifications SET link = '/circle?tab=network', action_url = '/circle?tab=network' 
WHERE category = 'match' AND link = '/circle';
