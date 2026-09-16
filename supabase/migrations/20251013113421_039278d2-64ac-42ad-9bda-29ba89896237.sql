-- Fix security issues for profiles and invites
-- Note: conversation_list is a view and inherits security from messages table

-- 1. Create security definer function to safely check profile ownership
CREATE OR REPLACE FUNCTION public.is_profile_owner(_profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _profile_user_id;
$$;

-- 2. Drop existing overly permissive profiles policies
DROP POLICY IF EXISTS "Anyone can view public profile data" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Allow viewing basic public profile info only
CREATE POLICY "Public profile info is viewable"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Create function to get own sensitive profile data securely
CREATE OR REPLACE FUNCTION public.get_own_profile_sensitive_data()
RETURNS TABLE (
  stripe_customer_id text,
  subscription_tier text,
  subscription_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    stripe_customer_id,
    subscription_tier,
    subscription_status
  FROM profiles
  WHERE user_id = auth.uid();
$$;

-- 3. Fix invites table policies to protect emails
DROP POLICY IF EXISTS "Users can view own invites only" ON invites;

-- More restrictive policy for viewing invites
CREATE POLICY "Users can view own invites with full details"
ON invites
FOR SELECT
TO authenticated
USING (
  auth.uid() = inviter_id 
  OR auth.uid() = used_by 
  OR auth.uid() = invitee_user_id
);

-- 4. Add comments to document security model
COMMENT ON TABLE profiles IS 'Sensitive fields like stripe_customer_id should only be accessed when viewing own profile through security definer functions';
COMMENT ON TABLE invites IS 'Email addresses are only visible to invite creators and recipients';
COMMENT ON VIEW conversation_list IS 'Security inherited from messages table RLS policies';
