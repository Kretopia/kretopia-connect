-- Fix email trigger functions to work without app.settings
-- The issue is that triggers use current_setting() which requires database-level config we can't set

-- Drop and recreate the send_welcome_email trigger function to handle errors gracefully
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  supabase_url TEXT := 'https://kwmcocsitwssrtzkdojh.supabase.co';
  service_key TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Get user name
  user_name := NEW.full_name;
  
  -- Try to get service role key from secrets
  -- If not available, log and skip email
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
    
    IF service_key IS NULL OR service_key = '' THEN
      RAISE WARNING 'Service role key not configured, skipping welcome email';
      RETURN NEW;
    END IF;
    
    -- Send welcome email via edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'to', user_email,
        'type', 'welcome',
        'data', jsonb_build_object(
          'userName', user_name,
          'dashboardUrl', supabase_url
        )
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the user creation
      RAISE WARNING 'Failed to send welcome email: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Update notify_on_match_with_email function similarly
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
  
  -- Try to send emails
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
    
    IF service_key IS NOT NULL AND service_key != '' THEN
      -- Send emails via edge function
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
      -- Log error but don't fail the match creation
      RAISE WARNING 'Failed to send match notification emails: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;