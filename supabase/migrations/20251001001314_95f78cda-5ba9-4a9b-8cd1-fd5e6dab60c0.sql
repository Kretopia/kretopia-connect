-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Add a policy to allow users to view their own profile even with just the anon key
-- This ensures the app works properly for authenticated users
CREATE POLICY "Users can view all profiles when authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);