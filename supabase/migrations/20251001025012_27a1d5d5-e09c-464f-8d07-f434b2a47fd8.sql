-- Add new profile fields for enhanced EPK
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS professional_skills JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS passion_skills JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS review_share_token TEXT UNIQUE DEFAULT substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 16);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_review_share_token ON public.profiles(review_share_token);

-- Update reviews table to support easier submission
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS submission_token TEXT,
ADD COLUMN IF NOT EXISTS reviewer_email TEXT;

-- Create public review submissions table for tracking
CREATE TABLE IF NOT EXISTS public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reviewer_email TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  project_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  share_token TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 20),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on review_requests
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own review requests
CREATE POLICY "Users can view own review requests"
ON public.review_requests
FOR SELECT
USING (auth.uid() = profile_id);

-- Policy: Users can create review requests
CREATE POLICY "Users can create review requests"
ON public.review_requests
FOR INSERT
WITH CHECK (auth.uid() = profile_id);

-- Policy: Anyone with token can view request (for public submission)
CREATE POLICY "Public can view with token"
ON public.review_requests
FOR SELECT
USING (share_token IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE public.review_requests IS 'Tracks review requests sent to clients/collaborators with shareable tokens';
COMMENT ON COLUMN public.profiles.professional_skills IS 'JSONB array of {skill: string, level: 1-5, category: string}';
COMMENT ON COLUMN public.profiles.passion_skills IS 'JSONB array of {skill: string, level: 1-5, category: string}';