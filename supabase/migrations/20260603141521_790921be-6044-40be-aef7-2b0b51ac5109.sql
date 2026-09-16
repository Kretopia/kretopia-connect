
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS casting_min_height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS casting_max_height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS casting_gender TEXT,
  ADD COLUMN IF NOT EXISTS casting_age_min INTEGER,
  ADD COLUMN IF NOT EXISTS casting_age_max INTEGER,
  ADD COLUMN IF NOT EXISTS casting_categories TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS casting_fitting_date DATE,
  ADD COLUMN IF NOT EXISTS casting_shoot_date DATE,
  ADD COLUMN IF NOT EXISTS casting_usage_summary TEXT;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS comp_card_snapshot JSONB;
