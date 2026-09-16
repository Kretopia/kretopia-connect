
-- Add ICDB fields to credits table
ALTER TABLE public.credits 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_links jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS client_brand text,
  ADD COLUMN IF NOT EXISTS payment_verified boolean DEFAULT false;
