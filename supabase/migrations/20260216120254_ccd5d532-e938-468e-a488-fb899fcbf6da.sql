
-- Add reaction support to room messages
CREATE TABLE IF NOT EXISTS public.spark_room_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.spark_room_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🔥',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.spark_room_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reactions"
  ON public.spark_room_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add reactions"
  ON public.spark_room_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
  ON public.spark_room_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add pinned_at to messages for pinning support
ALTER TABLE public.spark_room_messages
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID,
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.spark_room_messages(id) ON DELETE SET NULL;

-- Add room membership table for roles & moderation
CREATE TABLE IF NOT EXISTS public.spark_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- 'admin', 'moderator', 'member'
  is_muted BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.spark_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view members"
  ON public.spark_room_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join rooms"
  ON public.spark_room_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON public.spark_room_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Room admins can update members"
  ON public.spark_room_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.spark_room_members rm 
      WHERE rm.room_id = spark_room_members.room_id 
      AND rm.user_id = auth.uid() 
      AND rm.role IN ('admin', 'moderator')
    )
  );

-- Add search/trending support columns to rooms
ALTER TABLE public.spark_rooms
  ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rules TEXT;

-- Enable realtime for reactions and members
ALTER PUBLICATION supabase_realtime ADD TABLE public.spark_room_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spark_room_members;
