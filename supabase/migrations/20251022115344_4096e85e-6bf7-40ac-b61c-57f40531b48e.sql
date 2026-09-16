-- Drop legacy conflicting RLS policies on profiles table
-- These policies allow public access and conflict with new restrictive policies

DROP POLICY IF EXISTS "Public can view basic profile info only" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Connected users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Connected users view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Keep only the two new secure policies:
-- 1. "Users view own complete profile" - allows users to see their own data
-- 2. "Authenticated users view public profiles" - allows authenticated users to see limited public data via view