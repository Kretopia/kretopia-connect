-- Add is_message_request column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_message_request BOOLEAN DEFAULT false;