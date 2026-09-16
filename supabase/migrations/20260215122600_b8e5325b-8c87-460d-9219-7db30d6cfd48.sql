-- Add profile_frame column to store which frame the user has equipped
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_frame text DEFAULT null;

-- Example values: 'gradient_gold', 'gradient_rainbow', 'pulse_primary', etc.
COMMENT ON COLUMN public.profiles.profile_frame IS 'The active profile avatar frame style purchased from the Rewards Shop';