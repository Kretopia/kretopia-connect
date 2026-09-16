CREATE OR REPLACE FUNCTION public.notify_on_match_with_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
  user1_email TEXT;
  user2_email TEXT;
  service_key TEXT;
  supabase_url TEXT := 'https://kwmcocsitwssrtzkdojh.supabase.co';
BEGIN
  SELECT p.full_name, u.email INTO user1_name, user1_email
  FROM profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = NEW.user1_id;

  SELECT p.full_name, u.email INTO user2_name, user2_email
  FROM profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = NEW.user2_id;

  PERFORM create_notification(
    NEW.user1_id, 'New Match! 🎉',
    'You matched with ' || COALESCE(user2_name, 'someone') || ' — view their profile to say hi.',
    'match',
    '/profile/' || NEW.user2_id::text || '?from=match',
    '/profile/' || NEW.user2_id::text || '?from=match',
    'View profile', NULL, 'high', 'match'
  );

  PERFORM create_notification(
    NEW.user2_id, 'New Match! 🎉',
    'You matched with ' || COALESCE(user1_name, 'someone') || ' — view their profile to say hi.',
    'match',
    '/profile/' || NEW.user1_id::text || '?from=match',
    '/profile/' || NEW.user1_id::text || '?from=match',
    'View profile', NULL, 'high', 'match'
  );

  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;

    IF service_key IS NOT NULL AND service_key != '' THEN
      IF user1_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body := jsonb_build_object(
            'to', user1_email, 'type', 'match',
            'data', jsonb_build_object('userName', user1_name, 'matchName', user2_name)
          )
        );
      END IF;

      IF user2_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body := jsonb_build_object(
            'to', user2_email, 'type', 'match',
            'data', jsonb_build_object('userName', user2_name, 'matchName', user1_name)
          )
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send match notification emails: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
BEGIN
  SELECT full_name INTO user1_name FROM public.profiles WHERE user_id = NEW.user1_id;
  SELECT full_name INTO user2_name FROM public.profiles WHERE user_id = NEW.user2_id;

  PERFORM create_notification(
    NEW.user1_id, 'New Match! 🎉',
    'You matched with ' || COALESCE(user2_name, 'a creator') || ' — view their profile to say hi.',
    'match',
    '/profile/' || NEW.user2_id::text || '?from=match',
    '/profile/' || NEW.user2_id::text || '?from=match',
    'View profile', NULL, 'high', 'match'
  );

  PERFORM create_notification(
    NEW.user2_id, 'New Match! 🎉',
    'You matched with ' || COALESCE(user1_name, 'a creator') || ' — view their profile to say hi.',
    'match',
    '/profile/' || NEW.user1_id::text || '?from=match',
    '/profile/' || NEW.user1_id::text || '?from=match',
    'View profile', NULL, 'high', 'match'
  );

  RETURN NEW;
END;
$function$;