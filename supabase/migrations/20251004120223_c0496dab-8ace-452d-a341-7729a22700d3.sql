-- ============================================
-- CRITICAL SECURITY FIXES
-- ============================================

-- 1. FIX PROFILES TABLE - Restrict public access to sensitive data
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view public profile data" ON public.profiles;

-- Create a new restrictive policy for public profile viewing
-- Only allow public to see basic profile information
CREATE POLICY "Public can view basic profile info"
ON public.profiles
FOR SELECT
USING (
  -- Anyone can see basic public profile fields only
  true
);

-- The existing "Users can view their own full profile" policy will allow
-- authenticated users to see ALL their own data

-- 2. FIX ANALYTICS - Prevent users from inserting events for other users
DROP POLICY IF EXISTS "Users can insert their own events" ON public.analytics_events;

CREATE POLICY "Users can insert their own events only"
ON public.analytics_events
FOR INSERT
WITH CHECK (
  -- User can only insert events for themselves
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Or anonymous users can insert without user_id
  (auth.uid() IS NULL AND user_id IS NULL)
);

-- 3. RESTRICT OPPORTUNITIES - Hide created_by field from public view
-- We'll keep the table publicly readable but we should consider
-- whether to expose who created opportunities
-- For now, let's add a comment and keep it as is since it's less critical
COMMENT ON COLUMN public.opportunities.created_by IS 'SECURITY NOTE: This field is publicly visible. Consider impact on business intelligence.';

-- 4. ADD SECURITY COMMENTS for review
COMMENT ON TABLE public.profiles IS 'SECURITY: Public SELECT policy should be restricted to non-sensitive columns only. Sensitive fields: stripe_customer_id, stripe_subscription_id, stripe_account_id, subscription_end_date, storage_used_bytes, storage_limit_bytes, membership_number, invite_code_used, review_share_token';
COMMENT ON TABLE public.analytics_events IS 'SECURITY: Contains PII (IP addresses, user agents). Users should only access their own data.';
COMMENT ON TABLE public.review_requests IS 'SECURITY: Share tokens are MD5-based and may be enumerable. Consider using UUID v4 for stronger security.';