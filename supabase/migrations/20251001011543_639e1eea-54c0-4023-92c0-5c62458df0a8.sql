-- Create waitlist table for people without invite codes
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  instagram_url TEXT,
  twitter_url TEXT,
  linkedin_url TEXT,
  spotify_url TEXT,
  website TEXT,
  bio TEXT,
  why_join TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add invite tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS available_invites INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

-- Update invites table to add more tracking
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text || clock_timestamp()::text) from 1 for 8),
ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on waitlist
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Waitlist policies
CREATE POLICY "Anyone can submit to waitlist"
ON public.waitlist FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their own waitlist entry"
ON public.waitlist FOR SELECT
USING (auth.uid() IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Function to generate invite codes for a user
CREATE OR REPLACE FUNCTION generate_invite_codes(user_id_param UUID, num_codes INTEGER DEFAULT 5)
RETURNS VOID AS $$
BEGIN
  FOR i IN 1..num_codes LOOP
    INSERT INTO public.invites (inviter_id, invitee_email, status)
    VALUES (user_id_param, '', 'pending');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate and use an invite code
CREATE OR REPLACE FUNCTION use_invite_code(code TEXT, user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Find unused invite code
  SELECT * INTO invite_record
  FROM public.invites
  WHERE invite_code = code
  AND status = 'pending'
  AND used_by IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mark invite as used
  UPDATE public.invites
  SET 
    invitee_email = user_email,
    status = 'accepted',
    used_at = now()
  WHERE id = invite_record.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger for waitlist
CREATE TRIGGER update_waitlist_updated_at
BEFORE UPDATE ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Give initial users 5 invites when profile is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role, credits, available_invites)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'Creator'),
    10,
    5
  );
  
  -- Generate 5 invite codes for the new user
  PERFORM generate_invite_codes(new.id, 5);
  
  RETURN new;
END;
$$;