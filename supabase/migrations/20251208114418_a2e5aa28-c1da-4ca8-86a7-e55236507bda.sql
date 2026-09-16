-- Add collab_intent column to profiles table
-- Options: 'looking_to_hire', 'available_for_hire', 'open_to_trade', 'seeking_collaborators', 'just_networking'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS collab_intent text DEFAULT 'seeking_collaborators';

-- Add rate_range column for transparency (optional rate display)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rate_range text;

-- Create index for filtering by collab intent
CREATE INDEX IF NOT EXISTS idx_profiles_collab_intent ON public.profiles(collab_intent);