-- Add typing_at column to track when a user is typing in a conversation
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS typing_at timestamp with time zone;

-- Create index for efficient typing status lookups
CREATE INDEX IF NOT EXISTS idx_messages_typing ON public.messages(sender_id, receiver_id, typing_at);