-- Update all existing users to Pro tier with 1-month trial
UPDATE public.profiles
SET 
  subscription_tier = 'pro',
  subscription_status = 'trial',
  subscription_end_date = now() + interval '1 month'
WHERE subscription_tier = 'free' OR subscription_tier IS NULL;

-- Update the handle_new_user function to auto-assign Pro trial
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