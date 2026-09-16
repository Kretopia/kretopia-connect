-- Add branded company page columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS company_tagline TEXT,
  ADD COLUMN IF NOT EXISTS team_member_ids UUID[] DEFAULT '{}';