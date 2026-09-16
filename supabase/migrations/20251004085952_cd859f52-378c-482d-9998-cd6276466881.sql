-- Add image_url column to press_links table to store article preview images
ALTER TABLE public.press_links 
ADD COLUMN IF NOT EXISTS image_url TEXT;