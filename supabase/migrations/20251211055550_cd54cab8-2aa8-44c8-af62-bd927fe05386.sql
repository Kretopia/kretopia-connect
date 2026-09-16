-- Add verification_breakdown column to store detailed score breakdown
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verification_breakdown JSONB;