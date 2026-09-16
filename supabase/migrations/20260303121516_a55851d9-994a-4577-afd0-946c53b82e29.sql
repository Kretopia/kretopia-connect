-- Update handle_new_user to auto-connect new users with platform admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_uuid UUID := 'ef429714-ea32-4f08-a4f9-ef0226f1804b';
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    role,
    account_type,
    onboarding_completed,
    onboarding_step,
    subscription_tier,
    subscription_status,
    subscription_end_date
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'account_type' = 'company' THEN 'Company'
      ELSE 'Creator'
    END,
    COALESCE((NEW.raw_user_meta_data->>'account_type')::account_type, 'individual'),
    false,
    0,
    'free',
    'inactive',
    NULL
  );

  -- Auto-connect new user with platform admin (bidirectional)
  IF NEW.id != admin_uuid THEN
    BEGIN
      PERFORM public.create_bidirectional_connection(NEW.id, admin_uuid, 'accepted');
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail user creation if auto-connect fails
      RAISE WARNING 'Auto-connect failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;