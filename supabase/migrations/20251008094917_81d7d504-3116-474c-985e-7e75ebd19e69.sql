-- Fix review submission access for anonymous users

-- Allow anonymous users to read review_requests via valid tokens
CREATE POLICY "Anyone can view review requests by valid token"
ON public.review_requests
FOR SELECT
TO anon
USING (
  share_token IS NOT NULL
  AND status = 'pending'
  AND expires_at > now()
);

-- Allow anonymous users to view profiles when they have a valid review token
-- This is already covered by the existing policy, but we need to ensure review_requests is readable first

-- Allow anonymous users to insert reviews
CREATE POLICY "Anyone can submit reviews via valid token"
ON public.reviews
FOR INSERT
TO anon
WITH CHECK (
  -- Verify the review request exists and is valid
  EXISTS (
    SELECT 1
    FROM public.review_requests
    WHERE review_requests.profile_id = reviews.profile_id
      AND review_requests.status = 'pending'
      AND review_requests.expires_at > now()
  )
);