ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS usage_type text,
  ADD COLUMN IF NOT EXISTS usage_territory text,
  ADD COLUMN IF NOT EXISTS usage_duration text,
  ADD COLUMN IF NOT EXISTS usage_exclusive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS barter_gifted_value_usd numeric,
  ADD COLUMN IF NOT EXISTS barter_posting_deadline date,
  ADD COLUMN IF NOT EXISTS whitelisting_allowed boolean DEFAULT false;