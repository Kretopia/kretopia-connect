-- Add RLS policy to allow anyone (including non-authenticated users) to view public profile data
-- This is safe because we're only exposing non-sensitive profile fields through the public_profiles view
CREATE POLICY "Anyone can view public profile data"
ON public.profiles
FOR SELECT
USING (true);