-- Allow users to view basic profile information of users they're messaging
-- This is needed for the conversation_list view to work
CREATE POLICY "Users can view profiles of people they message"
  ON profiles
  FOR SELECT
  USING (
    -- Allow viewing own profile (already exists but adding for completeness)
    auth.uid() = user_id
    OR
    -- Allow viewing profiles of people you've sent messages to
    user_id IN (
      SELECT receiver_id FROM messages WHERE sender_id = auth.uid()
      UNION
      SELECT sender_id FROM messages WHERE receiver_id = auth.uid()
    )
  );