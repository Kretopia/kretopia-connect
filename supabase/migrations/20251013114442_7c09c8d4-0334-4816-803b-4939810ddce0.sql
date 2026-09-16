-- Create skill endorsement system similar to reviews

-- Table to track endorsement requests
CREATE TABLE public.skill_endorsement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  endorser_name text,
  endorser_email text NOT NULL,
  project_name text,
  share_token text UNIQUE NOT NULL DEFAULT generate_secure_token(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  personal_message text
);

-- Table to store actual endorsements
CREATE TABLE public.skill_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  request_id uuid REFERENCES skill_endorsement_requests(id) ON DELETE SET NULL,
  skill_name text NOT NULL,
  endorser_name text NOT NULL,
  endorser_email text NOT NULL,
  endorser_company text,
  project_name text,
  proficiency_level text NOT NULL CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  testimonial text,
  relationship text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verified boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE public.skill_endorsement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skill_endorsement_requests
CREATE POLICY "Users can view their own endorsement requests"
ON skill_endorsement_requests
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Users can create endorsement requests"
ON skill_endorsement_requests
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own requests"
ON skill_endorsement_requests
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid());

-- RLS Policies for skill_endorsements
CREATE POLICY "Anyone can view endorsements"
ON skill_endorsements
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Profile owners can view their endorsements"
ON skill_endorsements
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Security definer function to get endorsement request by token (public access)
CREATE OR REPLACE FUNCTION public.get_endorsement_request_by_token(token_param text)
RETURNS TABLE (
  id uuid,
  profile_id uuid,
  skill_name text,
  endorser_name text,
  endorser_email text,
  project_name text,
  share_token text,
  status text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  completed_at timestamp with time zone,
  personal_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    profile_id,
    skill_name,
    endorser_name,
    endorser_email,
    project_name,
    share_token,
    status,
    expires_at,
    created_at,
    completed_at,
    personal_message
  FROM public.skill_endorsement_requests
  WHERE share_token = token_param
    AND expires_at > now()
    AND status = 'pending'
  LIMIT 1;
$$;

-- Create indexes for performance
CREATE INDEX idx_skill_endorsement_requests_profile ON skill_endorsement_requests(profile_id);
CREATE INDEX idx_skill_endorsement_requests_token ON skill_endorsement_requests(share_token);
CREATE INDEX idx_skill_endorsements_profile ON skill_endorsements(profile_id);
CREATE INDEX idx_skill_endorsements_skill ON skill_endorsements(skill_name);