-- Security Fix: Drop conflicting RLS policies that allow overly broad access to sensitive profile data
-- These policies were exposing Stripe IDs, subscription data, and other sensitive fields to authenticated users

DROP POLICY IF EXISTS "Public can view basic profile info only" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Connected users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Connected users view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- The remaining policies provide appropriate access control:
-- 1. "Owner full access" - Users can fully manage their own profile
-- 2. "Users view own complete profile" - Users can see all their own data
-- 3. "Authenticated users view public profiles" - Limited data for discovery
-- 4. "Users can insert own profile" - Users can create their profile
-- 5. "Users can update own profile" - Users can update their profile