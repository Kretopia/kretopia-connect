-- Add verification system to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'flagged')),
ADD COLUMN IF NOT EXISTS verification_score integer,
ADD COLUMN IF NOT EXISTS verification_notes text,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS portfolio_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS social_verified boolean DEFAULT false;

-- Create verification_requests table for tracking verification attempts
CREATE TABLE IF NOT EXISTS verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_data jsonb NOT NULL,
  ai_score integer,
  ai_decision text,
  ai_reasoning text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on verification_requests
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification requests
CREATE POLICY "Users can view own verification requests"
ON verification_requests FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all verification requests
CREATE POLICY "Admins can view all verification requests"
ON verification_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update verification requests
CREATE POLICY "Admins can update verification requests"
ON verification_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);