
-- Add RLS policy for users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Also add policy to view other users' profiles (needed for Connect page, public profiles, etc.)
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
USING (true);
