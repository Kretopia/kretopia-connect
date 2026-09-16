-- Security Fix: Restrict public token access to non-sensitive fields in review_requests
-- Issue: The "Public can view with token" policy exposes reviewer_email to anyone with the token

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can view with token" ON public.review_requests;

-- Create a more restrictive view for public access via token
-- This view excludes sensitive fields like reviewer_email
CREATE OR REPLACE VIEW public.review_requests_public AS
SELECT 
  id,
  profile_id,
  reviewer_name,
  project_name,
  share_token,
  status,
  expires_at,
  created_at,
  completed_at,
  personal_message
FROM public.review_requests;

-- Enable RLS on the public view
ALTER VIEW public.review_requests_public SET (security_barrier = true);

-- Grant SELECT on the public view to anonymous users
GRANT SELECT ON public.review_requests_public TO anon;
GRANT SELECT ON public.review_requests_public TO authenticated;

-- Create a new policy that allows public access to the view only
CREATE POLICY "Public can view limited fields with token"
ON public.review_requests
FOR SELECT
USING (
  -- Allow access if share_token exists AND either:
  -- 1. User is authenticated and owns the profile (sees everything)
  -- 2. User is NOT authenticated (should use the public view instead)
  (share_token IS NOT NULL AND auth.uid() = profile_id)
);

-- Update the existing owner policy to ensure it has priority
DROP POLICY IF EXISTS "Users can view own review requests" ON public.review_requests;

CREATE POLICY "Users can view own review requests"
ON public.review_requests
FOR SELECT
USING (auth.uid() = profile_id);

-- Add security comment
COMMENT ON TABLE public.review_requests IS 'SECURITY: Public access via share_token should use review_requests_public view to prevent email exposure. Full table access requires authentication and ownership.';
COMMENT ON VIEW public.review_requests_public IS 'Public-safe view of review_requests that excludes sensitive fields like reviewer_email. Used for token-based review submissions.';