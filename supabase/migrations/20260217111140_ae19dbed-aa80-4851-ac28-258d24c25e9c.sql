-- Drop the overly restrictive discovery policy and replace with one that allows
-- any authenticated user to view any profile (needed for social feed interactions)
DROP POLICY IF EXISTS "Authenticated users can discover profiles" ON public.profiles;

CREATE POLICY "Any authenticated user can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
