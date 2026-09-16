-- Drop the overly permissive policy that exposes all profile data
DROP POLICY IF EXISTS "Users can view all profiles for discovery" ON public.profiles;

-- The remaining policies are now:
-- 1. "Allow anonymous users to view profiles via share token" - secure, limited access
-- 2. "Users can view their own profile" - secure, own data only
-- 3. "Enable profile updates for authenticated users" - secure, own data only
-- 4. "Allow users to insert their own profile" - secure, own data only

-- Note: For discovery features, the frontend must explicitly query only non-sensitive fields
-- The application layer is responsible for filtering what data is shown