-- Add OG promotion tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS og_promotion_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS og_promotion_expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.og_promotion_used IS 'Whether the OG user has claimed their 2-month free Thriver promotion';
COMMENT ON COLUMN public.profiles.og_promotion_expires_at IS 'When the OG promotion expires (2 months from activation)';