-- Allow authenticated users to discover profiles for the swipe/matching feature
-- This is standard for social/matching apps - users need to browse other profiles
CREATE POLICY "Authenticated users can discover profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);