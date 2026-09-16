-- Allow unauthenticated users to view basic profile information for endorsements
CREATE POLICY "Allow public to view profiles for endorsements"
ON public.profiles
FOR SELECT
TO public
USING (true);