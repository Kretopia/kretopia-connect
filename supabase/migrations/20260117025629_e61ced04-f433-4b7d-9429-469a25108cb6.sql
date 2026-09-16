-- Fix handle_new_user trigger to include trial subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'pro',
    'trial',
    now() + interval '1 month'
  );
  RETURN NEW;
END;
$$;

-- Fix existing users who signed up without trial - give them 1 month trial from now
UPDATE profiles 
SET 
  subscription_tier = 'pro',
  subscription_status = 'trial',
  subscription_end_date = now() + interval '1 month'
WHERE 
  (subscription_status IS NULL OR subscription_status IN ('inactive', 'none') OR subscription_tier = 'free')
  AND subscription_status != 'active';