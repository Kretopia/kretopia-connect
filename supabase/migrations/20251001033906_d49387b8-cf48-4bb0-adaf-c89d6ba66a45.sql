-- Add section order preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN section_order jsonb DEFAULT '["bio", "social_stats", "skills", "credits", "awards", "press", "social_links"]'::jsonb;