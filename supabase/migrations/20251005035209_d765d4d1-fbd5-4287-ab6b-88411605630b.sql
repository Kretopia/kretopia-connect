-- ============================================
-- FIX: Security Definer View Warning
-- Set all public views to SECURITY INVOKER mode
-- ============================================

-- Views default to SECURITY DEFINER which bypasses RLS and uses creator privileges.
-- We need SECURITY INVOKER so views respect RLS and use the calling user's permissions.

-- 1. Fix analytics_funnel view
ALTER VIEW public.analytics_funnel SET (security_invoker = on);

-- 2. Fix conversation_list view
ALTER VIEW public.conversation_list SET (security_invoker = on);

-- 3. Fix public_profiles view
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- 4. Fix user_applications_view
ALTER VIEW public.user_applications_view SET (security_invoker = on);

-- Add documentation
COMMENT ON VIEW public.analytics_funnel IS 'Analytics view with SECURITY INVOKER - respects RLS policies';
COMMENT ON VIEW public.conversation_list IS 'Message conversations with SECURITY INVOKER - respects RLS policies';
COMMENT ON VIEW public.public_profiles IS 'Public profile data with SECURITY INVOKER - safe for public access';
COMMENT ON VIEW public.user_applications_view IS 'User applications with SECURITY INVOKER - respects RLS policies';

-- Verify: These views will now execute with the permissions of the calling user,
-- not the creator (postgres), ensuring RLS policies are properly enforced.