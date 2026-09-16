CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  applicant_email TEXT;
  applicant_name TEXT;
  opp_title TEXT;
  email_enabled BOOLEAN;
  service_key TEXT;
  supabase_url TEXT := 'https://kwmcocsitwssrtzkdojh.supabase.co';
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  IF service_key IS NULL OR service_key = '' THEN
    RETURN NEW;
  END IF;

  SELECT u.email, p.full_name INTO applicant_email, applicant_name
  FROM auth.users u
  JOIN profiles p ON p.user_id = u.id
  WHERE u.id = NEW.applicant_id;

  SELECT email_opportunities INTO email_enabled
  FROM notification_preferences
  WHERE user_id = NEW.applicant_id;

  IF email_enabled IS NULL THEN
    email_enabled := true;
  END IF;

  SELECT title INTO opp_title FROM opportunities WHERE id = NEW.opportunity_id;

  IF email_enabled AND applicant_email IS NOT NULL THEN
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
      RAISE WARNING 'Failed to send application status email: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$func$;

CREATE OR REPLACE FUNCTION public.notify_on_match_with_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
    'You matched with ' || COALESCE(user2_name, 'someone'),
    'match',
    '/messages?user=' || NEW.user2_id::text,
    '/messages?user=' || NEW.user2_id::text,
    'Send Message', NULL, 'high', 'match'
  );

  PERFORM create_notification(
    NEW.user2_id, 'New Match! 🎉',
    'You matched with ' || COALESCE(user1_name, 'someone'),
    'match',
    '/messages?user=' || NEW.user1_id::text,
    '/messages?user=' || NEW.user1_id::text,
    'Send Message', NULL, 'high', 'match'
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
$func$;

CREATE OR REPLACE FUNCTION public.send_opportunity_alerts(opportunity_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  opp RECORD;
  user_rec RECORD;
  service_key TEXT;
  supabase_url TEXT := 'https://kwmcocsitwssrtzkdojh.supabase.co';
BEGIN
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'send_opportunity_alerts: no service key configured, skipping';
    RETURN;
  END IF;

  SELECT * INTO opp FROM opportunities WHERE id = opportunity_id_param;
  IF opp IS NULL THEN RETURN; END IF;

  FOR user_rec IN
    SELECT DISTINCT p.user_id, p.full_name, u.email
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id != opp.created_by
      AND COALESCE(p.subscription_tier, 'free') != 'free'
    LIMIT 50
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'to', user_rec.email,
          'type', 'opportunity',
          'data', jsonb_build_object(
            'userName', user_rec.full_name,
            'opportunityTitle', opp.title,
            'opportunityUrl', 'https://www.thrivein.io/opportunity/' || opp.id
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'send_opportunity_alerts: failed for %: %', user_rec.email, SQLERRM;
    END;
  END LOOP;
END;
$func$;