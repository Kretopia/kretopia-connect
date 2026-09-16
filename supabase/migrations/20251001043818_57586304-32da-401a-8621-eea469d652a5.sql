
-- Enable realtime for messages table
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Add the messages table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create an index for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);

-- Create a view for conversation list with latest message
CREATE OR REPLACE VIEW conversation_list AS
SELECT DISTINCT ON (
  CASE 
    WHEN m.sender_id < m.receiver_id 
    THEN m.sender_id || '_' || m.receiver_id
    ELSE m.receiver_id || '_' || m.sender_id
  END
)
  CASE 
    WHEN m.sender_id < m.receiver_id 
    THEN m.sender_id || '_' || m.receiver_id
    ELSE m.receiver_id || '_' || m.sender_id
  END as conversation_id,
  m.id as message_id,
  m.sender_id,
  m.receiver_id,
  m.content,
  m.created_at,
  m.read,
  m.match_id,
  sender.full_name as sender_name,
  sender.avatar_url as sender_avatar,
  receiver.full_name as receiver_name,
  receiver.avatar_url as receiver_avatar
FROM messages m
JOIN profiles sender ON sender.user_id = m.sender_id
JOIN profiles receiver ON receiver.user_id = m.receiver_id
ORDER BY 
  CASE 
    WHEN m.sender_id < m.receiver_id 
    THEN m.sender_id || '_' || m.receiver_id
    ELSE m.receiver_id || '_' || m.sender_id
  END,
  m.created_at DESC;

-- Grant access to the view
GRANT SELECT ON conversation_list TO authenticated;
