CREATE POLICY "Public can view profiles for discovery"
ON public.profiles
FOR SELECT
TO anon
USING (onboarding_completed = true);