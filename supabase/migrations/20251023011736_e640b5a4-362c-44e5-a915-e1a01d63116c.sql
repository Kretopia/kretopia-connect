
-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    role,
    account_type,
    onboarding_completed,
    onboarding_step
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
    0
  );
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Update existing users without profiles (safety check)
INSERT INTO public.profiles (user_id, full_name, role, account_type, onboarding_completed, onboarding_step)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', 'New User'),
  CASE 
    WHEN au.raw_user_meta_data->>'account_type' = 'company' THEN 'Company'
    ELSE 'Creator'
  END,
  COALESCE((au.raw_user_meta_data->>'account_type')::account_type, 'individual'),
  false,
  0
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
