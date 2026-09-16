-- Add youtube_url and tiktok_url columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text;