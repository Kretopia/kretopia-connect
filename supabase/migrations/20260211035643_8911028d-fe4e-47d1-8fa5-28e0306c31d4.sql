-- Update handle_new_user to assign FREE tier (no trial) for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  RETURN NEW;
END;
$function$;