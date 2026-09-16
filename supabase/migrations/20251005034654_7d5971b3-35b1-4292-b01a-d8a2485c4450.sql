-- ============================================
-- CRITICAL SECURITY FIX - Remove Permissive Public Access
-- ============================================

-- 1. DROP the overly permissive public profile policy
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- 2. Profiles should ONLY be accessible to:
--    - The owner (authenticated users viewing their own)
--    - Public via the public_profiles view (which excludes sensitive data)
-- The existing policies already handle owner access, so we're good here

-- 3. Fix analytics_events - Remove anonymous insert, restrict view to admins and own events
DROP POLICY IF EXISTS "Anonymous users can insert events" ON public.analytics_events;

-- Only allow authenticated users to insert their own events
CREATE POLICY "Authenticated users can insert own events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins or users can see their own analytics
DROP POLICY IF EXISTS "Users can view own events" ON public.analytics_events;

CREATE POLICY "Users can view own analytics only"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. Fix invoices - Only issuer and recipient should see them
DROP POLICY IF EXISTS "Users can view invoices they're involved in" ON public.invoices;

CREATE POLICY "Only issuer and recipient can view invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (auth.uid() = issued_by OR auth.uid() = issued_to);

-- 5. Ensure conversation_list view is properly secured (already done in previous migration)
-- The view has security_invoker = true and filters by auth.uid()

-- 6. Create admin-only policy for analytics (business intelligence)
CREATE POLICY "Admins can view all analytics"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 7. Create admin policy for invoices (platform oversight)
CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Verify RLS is enabled on all critical tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON VIEW public.public_profiles IS 'Safe public view of profiles - excludes sensitive data like Stripe IDs, payment info, and personal identifiers';
COMMENT ON POLICY "Users can view own analytics only" ON public.analytics_events IS 'Users can only see their own analytics events - IP addresses and tracking data protected';
COMMENT ON POLICY "Only issuer and recipient can view invoices" ON public.invoices IS 'Financial data restricted to the two parties in the transaction only';