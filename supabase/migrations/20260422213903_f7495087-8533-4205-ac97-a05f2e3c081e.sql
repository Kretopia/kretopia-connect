ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_intent text,
  ADD COLUMN IF NOT EXISTS intent_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS intent_week_start date;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_primary_intent_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_primary_intent_check
  CHECK (primary_intent IS NULL OR primary_intent IN ('collaborate','gigs','fund','manage'));

CREATE INDEX IF NOT EXISTS idx_profiles_primary_intent ON public.profiles(primary_intent) WHERE primary_intent IS NOT NULL;