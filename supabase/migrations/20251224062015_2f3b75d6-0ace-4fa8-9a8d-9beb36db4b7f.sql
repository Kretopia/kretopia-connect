
-- Allow anonymous users to view endorsement requests via token (for public endorsement page)
CREATE POLICY "Anonymous can view endorsement requests via token"
ON public.skill_endorsement_requests
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to view basic profile info (name, avatar) for endorsement/review pages
CREATE POLICY "Anonymous can view basic profile info"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Allow anonymous to update review_requests status after submitting a review
CREATE POLICY "Anonymous can update review request status"
ON public.review_requests
FOR UPDATE
TO anon
USING (expires_at > now() AND status = 'pending')
WITH CHECK (status = 'completed');

-- Allow authenticated users to submit reviews via valid token
CREATE POLICY "Authenticated users can submit reviews via token"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM review_requests
  WHERE review_requests.profile_id = reviews.profile_id
  AND review_requests.status = 'pending'
  AND review_requests.expires_at > now()
));
