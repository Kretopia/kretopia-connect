-- Fix SELECT policy: owners should always see their own opportunities regardless of status
DROP POLICY IF EXISTS "Anyone can view active opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Opportunities are viewable by everyone" ON public.opportunities;

-- Public can see active opportunities
CREATE POLICY "Public can view active opportunities"
  ON public.opportunities FOR SELECT
  USING (status = 'active');

-- Owners can always see their own opportunities (any status)
CREATE POLICY "Owners can view own opportunities"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = scouted_by);