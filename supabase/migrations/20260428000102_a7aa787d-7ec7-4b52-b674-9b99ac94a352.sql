-- 1. Allow 'unverified' in verification_tier (was blocking every new claim)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_verification_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_tier_check
  CHECK (verification_tier IS NULL OR verification_tier = ANY (ARRAY[
    'unverified'::text, 'verified'::text, 'industry'::text, 'elite'::text
  ]));

-- 2. Add missing columns to verification_requests (verify-profile edge function writes these)
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS portfolio_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awards_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS press_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS industry_fit_score integer,
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS social_proof_score integer;

-- 3. Rewrite send_welcome_email trigger to use the email queue (pgmq)
-- The legacy app.settings.service_role_key was never set, so welcome emails
-- silently failed to send. Switch to enqueue_email which uses Vault-stored
-- credentials and the same retry/rate-limit infrastructure as auth emails.
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  user_name := COALESCE(NEW.full_name, split_part(user_email, '@', 1));

  -- Enqueue welcome email via the transactional email queue.
  -- The process-email-queue cron drains this every 5s.
  BEGIN
    PERFORM public.enqueue_email(
      'transactional'::text,
      jsonb_build_object(
        'templateName', 'welcome',
        'recipientEmail', user_email,
        'idempotencyKey', 'welcome-' || NEW.user_id::text,
        'templateData', jsonb_build_object(
          'name', user_name
        )
      ),
      15  -- TTL minutes
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'send_welcome_email enqueue failed for %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;