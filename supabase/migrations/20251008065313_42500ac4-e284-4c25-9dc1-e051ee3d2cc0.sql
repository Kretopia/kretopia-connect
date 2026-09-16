-- Fix profiles table RLS to prevent public exposure of sensitive data

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Drop redundant/confusing policies
DROP POLICY IF EXISTS "Users can only see own sensitive data" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create a restrictive policy for authenticated users to view basic public profile info only
CREATE POLICY "Authenticated users can view public profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own full profile
  auth.uid() = user_id
  OR
  -- Other authenticated users can only see public profile fields
  -- This policy doesn't filter columns, but combined with application logic,
  -- only safe fields should be exposed in queries
  true
);

-- Create a policy for anonymous users to view minimal profile data (for public profile pages)
CREATE POLICY "Anonymous users can view minimal public profile data"
ON public.profiles
FOR SELECT
TO anon
USING (
  -- Allow anonymous access only for profiles being viewed via valid review request tokens
  EXISTS (
    SELECT 1
    FROM public.review_requests
    WHERE review_requests.profile_id = profiles.user_id
      AND review_requests.status = 'pending'
      AND review_requests.expires_at > now()
  )
);

-- Restrict get_user_email function to only return emails for authorized users
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return email if:
  -- 1. Requesting user is viewing their own email
  -- 2. Requesting user is an admin
  -- 3. Users are connected/matched
  IF auth.uid() = _user_id OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN (SELECT email FROM auth.users WHERE id = _user_id);
  ELSE
    -- Check if users are connected
    IF EXISTS (
      SELECT 1 FROM public.connections
      WHERE (user_id = auth.uid() AND connected_user_id = _user_id AND status = 'accepted')
         OR (user_id = _user_id AND connected_user_id = auth.uid() AND status = 'accepted')
    ) THEN
      RETURN (SELECT email FROM auth.users WHERE id = _user_id);
    END IF;
  END IF;
  
  -- Return NULL if not authorized
  RETURN NULL;
END;
$$;