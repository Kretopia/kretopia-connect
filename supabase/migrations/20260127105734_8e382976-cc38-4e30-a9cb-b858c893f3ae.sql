-- Add foreign key relationship from creative_jams to profiles
-- This fixes the PGRST200 error when joining with profiles
ALTER TABLE public.creative_jams 
ADD CONSTRAINT creative_jams_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;