
-- Add trust signal verification columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS id_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS id_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_verified boolean NOT NULL DEFAULT false;

-- Create a function to auto-set email_verified based on auth.users confirmation
-- This will be called when profiles are queried or updated
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_confirmed boolean;
BEGIN
  -- Check if email is confirmed in auth.users
  SELECT (email_confirmed_at IS NOT NULL) INTO is_confirmed
  FROM auth.users WHERE id = NEW.user_id;
  
  IF is_confirmed IS NOT NULL THEN
    NEW.email_verified := is_confirmed;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Sync email verification on profile updates
CREATE TRIGGER sync_email_on_profile_update
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_email_verification();

-- Also set payment_verified based on stripe_customer_id presence
CREATE OR REPLACE FUNCTION public.sync_payment_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.payment_verified := (NEW.stripe_customer_id IS NOT NULL AND NEW.stripe_customer_id != '');
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_payment_on_profile_update
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_verification();

-- Backfill existing profiles: email_verified from auth.users
UPDATE public.profiles p
SET email_verified = true
FROM auth.users u
WHERE u.id = p.user_id AND u.email_confirmed_at IS NOT NULL;

-- Backfill existing profiles: payment_verified from stripe_customer_id
UPDATE public.profiles
SET payment_verified = true
WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != '';
