-- Rewrite send_welcome_email to use Vault (which IS configured) and call
-- send-transactional-email which renders the template and enqueues properly.
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
  user_name TEXT;
  service_key TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  user_name := COALESCE(NEW.full_name, split_part(user_email, '@', 1));

  -- Try Vault first (used by email queue infra), then fall back to app settings.
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  IF service_key IS NULL OR service_key = '' THEN
    BEGIN
      service_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      service_key := NULL;
    END;
  END IF;

  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'send_welcome_email: no service key available, skipping for %', NEW.user_id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://kwmcocsitwssrtzkdojh.supabase.co/functions/v1/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'templateName', 'welcome',
        'recipientEmail', user_email,
        'idempotencyKey', 'welcome-' || NEW.user_id::text,
        'templateData', jsonb_build_object('name', user_name)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'send_welcome_email http_post failed for %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;