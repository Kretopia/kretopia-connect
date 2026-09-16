
-- Add reply_to column for threaded messages
ALTER TABLE public.project_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.project_messages(id) ON DELETE SET NULL;

-- Add is_pinned column for pinned messages
ALTER TABLE public.project_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Create message reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.project_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_reactions
CREATE POLICY "Users can view reactions on their project messages"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_messages pm
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.id = message_reactions.message_id
      AND public.user_has_project_access(pm.project_id, auth.uid())
    )
  );

CREATE POLICY "Users can add reactions to project messages"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM project_messages pm
      WHERE pm.id = message_id
      AND public.user_has_project_access(pm.project_id, auth.uid())
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Create index for performance
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_project_messages_reply_to ON public.project_messages(reply_to);
