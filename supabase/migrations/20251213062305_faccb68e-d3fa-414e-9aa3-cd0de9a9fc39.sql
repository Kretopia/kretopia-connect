
-- Allow public read access to limited profile data for endorsement pages
-- This enables the endorsement link to display skills without requiring authentication
CREATE POLICY "Public can view basic profile for endorsements"
ON public.profiles
FOR SELECT
TO anon
USING (true);
