-- Fix connection request notification to link to requester's profile
CREATE OR REPLACE FUNCTION public.notify_on_connection_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  requester_name TEXT;
BEGIN
  -- Only notify on pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO requester_name FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    NEW.connected_user_id,
    '🤝 Connection Request',
    COALESCE(requester_name, 'Someone') || ' wants to connect with you',
    'connection',
    '/profile/' || NEW.user_id::text,
    '/profile/' || NEW.user_id::text,
    'View Profile',
    NULL,
    'high',
    'connection'
  );

  RETURN NEW;
END;
$function$;

-- Fix existing connection notifications that point to /circle
UPDATE notifications
SET link = '/profile/' || COALESCE(
    (SELECT c.user_id::text FROM connections c 
     WHERE c.connected_user_id = notifications.user_id
     AND c.created_at <= notifications.created_at + interval '5 seconds'
     AND c.created_at >= notifications.created_at - interval '5 seconds'
     ORDER BY c.created_at DESC LIMIT 1),
    link
  ),
  action_url = '/profile/' || COALESCE(
    (SELECT c.user_id::text FROM connections c 
     WHERE c.connected_user_id = notifications.user_id
     AND c.created_at <= notifications.created_at + interval '5 seconds'
     AND c.created_at >= notifications.created_at - interval '5 seconds'
     ORDER BY c.created_at DESC LIMIT 1),
    action_url
  ),
  action_text = 'View Profile'
WHERE type = 'connection' 
  AND (link = '/circle' OR action_url = '/circle');