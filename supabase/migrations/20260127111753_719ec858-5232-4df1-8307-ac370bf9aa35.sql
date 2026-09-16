-- Create session messages table for group chat
CREATE TABLE public.session_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Create index for faster message queries
CREATE INDEX idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX idx_session_messages_created_at ON public.session_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- Participants can read messages from sessions they've joined
CREATE POLICY "Participants can view session messages"
  ON public.session_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jam_participants jp
      WHERE jp.jam_id = session_id
        AND jp.user_id = auth.uid()
        AND jp.status IN ('going', 'interested', 'maybe')
    )
    OR EXISTS (
      SELECT 1 FROM public.creative_jams cj
      WHERE cj.id = session_id
        AND cj.created_by = auth.uid()
    )
  );

-- Participants can send messages to sessions they've joined
CREATE POLICY "Participants can send messages"
  ON public.session_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.jam_participants jp
        WHERE jp.jam_id = session_id
          AND jp.user_id = auth.uid()
          AND jp.status IN ('going', 'interested', 'maybe')
      )
      OR EXISTS (
        SELECT 1 FROM public.creative_jams cj
        WHERE cj.id = session_id
          AND cj.created_by = auth.uid()
      )
    )
  );

-- Session creators can soft-delete any message (moderation)
CREATE POLICY "Session creators can moderate messages"
  ON public.session_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creative_jams cj
      WHERE cj.id = session_id
        AND cj.created_by = auth.uid()
    )
  );

-- Add RLS policy for jam_participants to allow session creators to remove participants
CREATE POLICY "Session creators can remove participants"
  ON public.jam_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.creative_jams cj
      WHERE cj.id = jam_id
        AND cj.created_by = auth.uid()
    )
  );

-- Users can update their own participation status
CREATE POLICY "Users can update own participation"
  ON public.jam_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable realtime for session messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;