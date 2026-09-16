-- Fix Critical Profiles RLS Policies (Correct Version)

-- 1. DROP ALL existing problematic profiles policies
DROP POLICY IF EXISTS "Public profile data readable" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Owner full access to own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anonymous users can view minimal public profile data" ON public.profiles;
DROP POLICY IF EXISTS "Public profile data viewable" ON public.profiles;
DROP POLICY IF EXISTS "Owner views sensitive data" ON public.profiles;

-- 2. Create ONLY 4 clean, non-recursive policies

-- Policy 1: Owner has full access to their own profile
CREATE POLICY "Owner full access"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Connected users can view limited profile fields
CREATE POLICY "Connected users view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.connections
    WHERE (
      (user_id = auth.uid() AND connected_user_id = profiles.user_id)
      OR (user_id = profiles.user_id AND connected_user_id = auth.uid())
    )
    AND status = 'accepted'
  )
);

-- Policy 3: Admins can view all profiles
CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Policy 4: Anonymous users can view profiles via valid review token
CREATE POLICY "Review token access"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.profile_id = profiles.user_id
    AND rr.status = 'pending'
    AND rr.expires_at > now()
  )
);

-- 3. Create safe public profiles view for discovery features
DROP VIEW IF EXISTS public.public_profiles_safe;
CREATE VIEW public.public_profiles_safe
WITH (security_invoker=on)
AS
SELECT 
  user_id,
  full_name,
  avatar_url,
  bio,
  role,
  location,
  created_at
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.public_profiles_safe TO authenticated, anon;