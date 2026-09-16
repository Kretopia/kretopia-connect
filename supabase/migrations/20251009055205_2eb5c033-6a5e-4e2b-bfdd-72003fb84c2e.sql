-- Add company_images field to profiles table for image gallery
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_images jsonb DEFAULT '[]'::jsonb;