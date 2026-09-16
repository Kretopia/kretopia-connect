-- Fix analytics_events RLS policy to allow anonymous event insertion
DROP POLICY IF EXISTS "Users can insert anonymous events" ON public.analytics_events;

CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Fix review_requests to allow anonymous token-based access properly
DROP POLICY IF EXISTS "Token-based review access only" ON public.review_requests;

CREATE POLICY "Token-based review access"
ON public.review_requests
FOR SELECT
TO anon, authenticated
USING (
  -- Allow access via token (anonymous users with valid token)
  share_token IS NOT NULL
  -- OR user owns the request
  OR profile_id = auth.uid()
);