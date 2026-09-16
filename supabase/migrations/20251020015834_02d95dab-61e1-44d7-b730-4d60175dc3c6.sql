-- Enable email notifications for key events

-- 1. Update the match notification trigger to send emails
CREATE OR REPLACE FUNCTION public.notify_on_match_with_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
  user1_email TEXT;
  user2_email TEXT;
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
  
  -- Create in-app notifications
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
  
  -- Send emails via edge function
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the match creation
    RAISE WARNING 'Failed to send match notification emails: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Create/update welcome email trigger
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Get user name
  user_name := NEW.full_name;

  -- Send welcome email via edge function
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'to', user_email,
      'type', 'welcome',
      'data', jsonb_build_object(
        'userName', user_name,
        'dashboardUrl', current_setting('app.settings.supabase_url', true)
      )
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to send welcome email: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the welcome email trigger exists
DROP TRIGGER IF EXISTS send_welcome_email_trigger ON profiles;
CREATE TRIGGER send_welcome_email_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_email();

-- 3. Add app settings for edge function URLs
-- These settings are used by the triggers above
DO $$
BEGIN
  -- Set the Supabase URL setting if it doesn't exist
  PERFORM set_config('app.settings.supabase_url', 'https://kwmcocsitwssrtzkdojh.supabase.co', false);
  PERFORM set_config('app.settings.service_role_key', current_setting('service_role.jwt_secret', true), false);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not set app settings: %', SQLERRM;
END;
$$;