-- Add columns for Circles elevation
ALTER TABLE spark_rooms ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
ALTER TABLE spark_rooms ADD COLUMN IF NOT EXISTS invite_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex');
ALTER TABLE spark_rooms ADD COLUMN IF NOT EXISTS icon_emoji text DEFAULT '💬';

-- Add columns for rich messaging (threads, reactions, polls, media)
ALTER TABLE spark_room_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES spark_room_messages(id) ON DELETE SET NULL;
ALTER TABLE spark_room_messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE spark_room_messages ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}';
ALTER TABLE spark_room_messages ADD COLUMN IF NOT EXISTS poll_data jsonb DEFAULT NULL;
ALTER TABLE spark_room_messages ADD COLUMN IF NOT EXISTS media_type text DEFAULT NULL;

-- Create message reactions table for proper tracking
CREATE TABLE IF NOT EXISTS spark_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES spark_room_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '🔥',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE spark_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS for message reactions
CREATE POLICY "Anyone can view reactions" ON spark_message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add reactions" ON spark_message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON spark_message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.spark_message_reactions;