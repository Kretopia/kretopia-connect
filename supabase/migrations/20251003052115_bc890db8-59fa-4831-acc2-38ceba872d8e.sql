-- Add application status email notification trigger
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  applicant_email TEXT;
  applicant_name TEXT;
  opp_title TEXT;
  email_enabled BOOLEAN;
BEGIN
  -- Only send email on status updates (not initial creation)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get applicant info
  SELECT u.email, p.full_name INTO applicant_email, applicant_name
  FROM auth.users u
  JOIN profiles p ON p.user_id = u.id
  WHERE u.id = NEW.applicant_id;

  -- Check if user has email notifications enabled
  SELECT email_opportunities INTO email_enabled
  FROM notification_preferences
  WHERE user_id = NEW.applicant_id;

  -- Default to true if no preference set
  IF email_enabled IS NULL THEN
    email_enabled := true;
  END IF;

  -- Get opportunity title
  SELECT title INTO opp_title
  FROM opportunities
  WHERE id = NEW.opportunity_id;

  -- Send email if enabled
  IF email_enabled THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'to', applicant_email,
        'type', 'application',
        'data', jsonb_build_object(
          'userName', applicant_name,
          'projectName', opp_title,
          'applicationStatus', NEW.status
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for application status changes
DROP TRIGGER IF EXISTS notify_application_status_trigger ON applications;
CREATE TRIGGER notify_application_status_trigger
  AFTER UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_application_status_change();

-- Update send_welcome_email to check preferences
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
  user_name TEXT;
  email_enabled BOOLEAN;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
  user_name := NEW.full_name;

  -- Check if user has email notifications enabled (default to true for new users)
  SELECT COALESCE(email_opportunities, true) INTO email_enabled
  FROM notification_preferences
  WHERE user_id = NEW.user_id;
  
  -- Send welcome email if enabled
  IF email_enabled THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'to', user_email,
        'type', 'welcome',
        'data', jsonb_build_object(
          'userName', user_name
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update match notification to check preferences
CREATE OR REPLACE FUNCTION public.notify_on_match_with_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
  user1_email TEXT;
  user2_email TEXT;
  user1_email_enabled BOOLEAN;
  user2_email_enabled BOOLEAN;
BEGIN
  -- Get user names and emails
  SELECT full_name INTO user1_name FROM profiles WHERE user_id = NEW.user1_id;
  SELECT full_name INTO user2_name FROM profiles WHERE user_id = NEW.user2_id;
  
  SELECT email INTO user1_email FROM auth.users WHERE id = NEW.user1_id;
  SELECT email INTO user2_email FROM auth.users WHERE id = NEW.user2_id;

  -- Check email preferences
  SELECT COALESCE(email_matches, true) INTO user1_email_enabled
  FROM notification_preferences WHERE user_id = NEW.user1_id;
  
  SELECT COALESCE(email_matches, true) INTO user2_email_enabled
  FROM notification_preferences WHERE user_id = NEW.user2_id;
  
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
  
  -- Send email notifications if enabled
  IF user1_email_enabled THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
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
  END IF;
  
  IF user2_email_enabled THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
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
  
  RETURN NEW;
END;
$function$;