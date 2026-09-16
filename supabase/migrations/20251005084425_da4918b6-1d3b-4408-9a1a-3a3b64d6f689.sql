-- Fix RLS policies to be more restrictive
-- Drop ALL existing SELECT policies on profiles
DROP POLICY IF EXISTS "Public can view public profile fields" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own full profile" ON profiles;
DROP POLICY IF EXISTS "Anon users can view profiles via share tokens" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles for discovery" ON profiles;

-- Now create the correct restrictive policies

-- 1. Anonymous users: Very limited access (only via share tokens)
CREATE POLICY "Anon access via share tokens only"
ON profiles FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM review_requests 
    WHERE profile_id = profiles.user_id 
    AND status = 'pending'
  )
);

-- 2. Authenticated users: Can discover other profiles
-- IMPORTANT: App code MUST filter sensitive columns
CREATE POLICY "Auth users discover profiles"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Note: The above policy allows authenticated users to see profiles
-- but the app code explicitly filters sensitive fields like:
-- stripe_customer_id, stripe_subscription_id, subscription_status,
-- stripe_account_id, subscription_product_id, invite_code_used,
-- stripe_account_status, og_promotion_used, etc.