
DROP POLICY IF EXISTS "Users can update their own jams" ON public.creative_jams;
CREATE POLICY "Users can update their own jams"
  ON public.creative_jams
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
