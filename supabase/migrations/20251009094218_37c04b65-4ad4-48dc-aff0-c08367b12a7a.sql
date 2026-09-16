-- Fix critical security vulnerabilities

-- 1. Fix analytics_events RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can insert their own events" ON analytics_events;
DROP POLICY IF EXISTS "Users can view own analytics" ON analytics_events;
DROP POLICY IF EXISTS "Admins can view all analytics" ON analytics_events;
DROP POLICY IF EXISTS "Admins can view all events" ON analytics_events;

-- Create secure policies: users can only insert their own events, never view raw analytics
CREATE POLICY "Users can insert anonymous events"
ON analytics_events
FOR INSERT
TO authenticated, anon
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
  (auth.uid() IS NULL AND user_id IS NULL)
);

-- Only admins can view analytics data
CREATE POLICY "Only admins can view analytics"
ON analytics_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 2. Fix invites table RLS policies  
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view own invites" ON invites;

-- Users can only see invites they created OR were invited with (used_by)
CREATE POLICY "Users can view own invites only"
ON invites
FOR SELECT
TO authenticated
USING (
  auth.uid() = inviter_id OR 
  auth.uid() = used_by OR 
  auth.uid() = invitee_user_id
);

-- 3. Fix partner_submissions RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view their own submission status" ON partner_submissions;

-- Users can only view their own submissions (by email), admins can view all
CREATE POLICY "Users can view own submissions by email"
ON partner_submissions
FOR SELECT
TO authenticated
USING (
  contact_email = get_user_email(auth.uid()) OR 
  has_role(auth.uid(), 'admin')
);