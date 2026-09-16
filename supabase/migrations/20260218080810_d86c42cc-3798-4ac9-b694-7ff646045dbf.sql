
-- Allow users to check if they've been blocked (needed to filter discovery)
CREATE POLICY "Users can check if blocked by others" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = blocked_user_id);
