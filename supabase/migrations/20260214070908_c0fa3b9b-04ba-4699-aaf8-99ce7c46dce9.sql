
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  applicant_email TEXT;
  applicant_name TEXT;
  opp_title TEXT;
  email_enabled BOOLEAN;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only send email on status updates (not initial creation)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Try to get config, but don't fail if missing
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Config not available, skip email but allow the update
    RETURN NEW;
  END;

  -- If config is missing, skip email but allow update
  IF supabase_url IS NULL OR service_key IS NULL OR supabase_url = '' OR service_key = '' THEN
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
    BEGIN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
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
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail the update if email sending fails
      RAISE WARNING 'Failed to send application status email: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
