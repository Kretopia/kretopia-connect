
-- Add Creator Site columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS site_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS site_template TEXT DEFAULT 'bold-electric';
