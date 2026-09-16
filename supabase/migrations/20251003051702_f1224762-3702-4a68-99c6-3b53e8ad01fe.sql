-- Function to send welcome email when user signs up
CREATE OR REPLACE FUNCTION send_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
  user_name := NEW.full_name;
  
  -- Call edge function to send welcome email (async, don't wait for response)
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
  
  RETURN NEW;
END;
$$;

-- Trigger to send welcome email
DROP TRIGGER IF EXISTS send_welcome_email_trigger ON profiles;
CREATE TRIGGER send_welcome_email_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION send_welcome_email();

-- Update match notification function to also send emails
CREATE OR REPLACE FUNCTION notify_on_match_with_email()
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
BEGIN
  -- Get user names and emails
  SELECT full_name INTO user1_name FROM profiles WHERE user_id = NEW.user1_id;
  SELECT full_name INTO user2_name FROM profiles WHERE user_id = NEW.user2_id;
  
  SELECT email INTO user1_email FROM auth.users WHERE id = NEW.user1_id;
  SELECT email INTO user2_email FROM auth.users WHERE id = NEW.user2_id;
  
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
  
  -- Send email notifications (async)
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
  
  RETURN NEW;
END;
$$;

-- Replace the old trigger
DROP TRIGGER IF EXISTS notify_on_match_trigger ON matches;
CREATE TRIGGER notify_on_match_trigger
AFTER INSERT ON matches
FOR EACH ROW
EXECUTE FUNCTION notify_on_match_with_email();

-- Function to send opportunity alert emails (will be called manually or via cron)
CREATE OR REPLACE FUNCTION send_opportunity_alerts(opportunity_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opp RECORD;
  user_rec RECORD;
  user_email TEXT;
BEGIN
  -- Get opportunity details
  SELECT * INTO opp
  FROM opportunities
  WHERE id = opportunity_id_param;
  
  -- Find users with matching skills (simplified matching logic)
  FOR user_rec IN
    SELECT DISTINCT p.user_id, p.full_name, u.email
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id != opp.created_by
      AND p.subscription_tier != 'free' -- Only notify paid users
    LIMIT 50 -- Limit to 50 users per opportunity
  LOOP
    -- Send email notification
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'to', user_rec.email,
        'type', 'opportunity',
        'data', jsonb_build_object(
          'userName', user_rec.full_name,
          'opportunityTitle', opp.title,
          'opportunityUrl', current_setting('app.settings.supabase_url') || '/opportunity/' || opp.id
        )
      )
    );
  END LOOP;
END;
$$;