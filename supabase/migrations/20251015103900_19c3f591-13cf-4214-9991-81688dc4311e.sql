-- Add onboarding tracking fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS onboarding_reminder_sent boolean DEFAULT false;

-- Create index for efficient querying of incomplete onboarding
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_incomplete 
ON public.profiles(onboarding_started_at) 
WHERE onboarding_completed = false AND onboarding_started_at IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.onboarding_step IS 'Current step in onboarding flow: 0=not started, 1=profile, 2=skills, 3=connect, 4=complete';
COMMENT ON COLUMN public.profiles.onboarding_started_at IS 'Timestamp when user first started onboarding';
COMMENT ON COLUMN public.profiles.onboarding_reminder_sent IS 'Whether we have sent a reminder to complete onboarding';