ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS day2_engagement_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS day5_engagement_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_day2_engagement
ON public.profiles (created_at)
WHERE day2_engagement_sent_at IS NULL AND onboarding_completed = true;

CREATE INDEX IF NOT EXISTS idx_profiles_day5_engagement
ON public.profiles (created_at)
WHERE day5_engagement_sent_at IS NULL AND onboarding_completed = true;