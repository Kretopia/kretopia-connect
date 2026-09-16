
ALTER TABLE public.scout_preferences
  ADD COLUMN IF NOT EXISTS job_types text[],
  ADD COLUMN IF NOT EXISTS employment_types text[],
  ADD COLUMN IF NOT EXISTS locations text[],
  ADD COLUMN IF NOT EXISTS travel_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instructions text;
