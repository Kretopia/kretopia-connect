-- Restore the notification_preferences.email_matches check on match emails.
--
-- notify_on_match_with_email() used to gate its two send-notification-email
-- calls on COALESCE(email_matches, true) per recipient (added in
-- 20251003052115). A later rewrite (20260503163349) that moved the service
-- role key lookup from a GUC (current_setting) to Supabase Vault carried
-- the http_post calls forward but dropped the preference check -- match
-- emails have since gone out unconditionally, ignoring a user's own
-- "New Matches" email toggle in Settings.
--
-- This restores the same opt-out semantics used elsewhere for this same
-- preference (e.g. notify-swipe/index.ts: `!prefs || prefs.email_matches
-- !== false`) -- a user with no notification_preferences row, or with
-- email_matches left at its column default of true, still gets the email;
-- only an explicit false suppresses it. In-app notifications (create_notification)
-- are unaffected -- only the two net.http_post email calls are gated, matching
-- how every other preference-respecting sender in this codebase only gates
-- the email step, not the in-app one.
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
  user1_email_enabled BOOLEAN;
  user2_email_enabled BOOLEAN;
  service_key TEXT;
  supabase_url TEXT := 'https://kwmcocsitwssrtzkdojh.supabase.co';
BEGIN
  SELECT p.full_name, u.email INTO user1_name, user1_email
  FROM profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = NEW.user1_id;

  SELECT p.full_name, u.email INTO user2_name, user2_email
  FROM profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = NEW.user2_id;

  SELECT COALESCE(email_matches, true) INTO user1_email_enabled
  FROM notification_preferences WHERE user_id = NEW.user1_id;
  user1_email_enabled := COALESCE(user1_email_enabled, true);

  SELECT COALESCE(email_matches, true) INTO user2_email_enabled
  FROM notification_preferences WHERE user_id = NEW.user2_id;
  user2_email_enabled := COALESCE(user2_email_enabled, true);

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
      IF user1_email IS NOT NULL AND user1_email_enabled THEN
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

      IF user2_email IS NOT NULL AND user2_email_enabled THEN
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
