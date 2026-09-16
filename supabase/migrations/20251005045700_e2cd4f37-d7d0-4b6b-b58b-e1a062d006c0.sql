-- Fix the security definer view issue by using a function instead

-- Drop the problematic view
DROP VIEW IF EXISTS public.review_requests_public CASCADE;

-- Revoke the grants
REVOKE SELECT ON public.review_requests FROM anon;

-- Update the policy to only allow authenticated users who own the profile
DROP POLICY IF EXISTS "Public can view limited fields with token" ON public.review_requests;

-- Create a secure function to retrieve non-sensitive review request data by token
CREATE OR REPLACE FUNCTION public.get_review_request_by_token(token_param TEXT)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  reviewer_name TEXT,
  project_name TEXT,
  share_token TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  personal_message TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  FROM public.review_requests
  WHERE share_token = token_param
    AND expires_at > now()
    AND status = 'pending'
  LIMIT 1;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_review_request_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_review_request_by_token(TEXT) TO authenticated;

-- Add security comment
COMMENT ON FUNCTION public.get_review_request_by_token IS 'SECURITY: Returns non-sensitive fields from review_requests for public token-based access. Excludes reviewer_email to protect privacy.';