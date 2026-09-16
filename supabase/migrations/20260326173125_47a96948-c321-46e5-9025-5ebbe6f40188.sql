
-- Add cross-verification support to credits table
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS verified_by_user_id uuid;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS verified_by_name text;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS collaborator_user_ids uuid[] DEFAULT '{}';

-- Add credit_score to profiles for the profile strength meter
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_score integer DEFAULT 0;
