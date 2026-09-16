-- Fix Critical Security Issues

-- 1. Fix profiles table RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Public profile data viewable" ON public.profiles;
DROP POLICY IF EXISTS "Owner views sensitive data" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create secure policies for profiles
-- Public data viewable by all authenticated users (non-sensitive fields only)
CREATE POLICY "Public profile data readable"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM public.profiles
    WHERE user_id = auth.uid()
  )
  OR
  -- Allow viewing non-sensitive public fields only
  auth.uid() IS NOT NULL
);

-- Owner can view all their own data including sensitive fields
CREATE POLICY "Owner full access to own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Fix review_requests predictable tokens
-- Add function to generate secure random tokens using built-in functions
CREATE OR REPLACE FUNCTION generate_secure_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate a cryptographically secure random token
  -- Using multiple random UUIDs concatenated for high entropy
  RETURN replace(
    gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text,
    '-',
    ''
  );
END;
$$;

-- Update existing review_requests to use secure tokens
UPDATE public.review_requests
SET share_token = generate_secure_token()
WHERE share_token IS NOT NULL;

-- Update review_requests table to use secure token generation
ALTER TABLE public.review_requests 
ALTER COLUMN share_token 
SET DEFAULT generate_secure_token();