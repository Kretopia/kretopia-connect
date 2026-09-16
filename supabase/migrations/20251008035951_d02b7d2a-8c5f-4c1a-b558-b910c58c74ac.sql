-- Add onboarding_completed column to profiles table
ALTER TABLE public.profiles
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false NOT NULL;