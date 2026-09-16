-- Enable RLS on conversation_list view
ALTER VIEW conversation_list SET (security_invoker = true);

-- Create RLS policy for conversation_list
-- Note: Views use security_invoker mode, so policies are checked on underlying tables
-- The messages table already has proper RLS, but we need to ensure the joins work

-- Add a policy to allow users to see their conversations
-- This is actually handled by the messages table RLS, but we make it explicit
CREATE POLICY "Users can view their conversations"
  ON messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );