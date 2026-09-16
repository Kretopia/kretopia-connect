-- CRITICAL: Lock down profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove any public access policies
DROP POLICY IF EXISTS "Public profiles viewable by authenticated users" ON public.profiles;

-- Ensure only these policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;