-- Kreto conversation sessions: the ai_conversations/ai_messages schema and
-- RLS (20260211172225) already fully supports a real multi-conversation
-- system — SELECT/INSERT/UPDATE/DELETE are all already scoped to
-- auth.uid() = user_id, and ai_messages cascades on conversation delete.
-- Nothing in this migration changes that; it only adds what's missing:
--
-- 1. archived_at — "archive is preferred over destructive deletion" per
--    the feature brief, and no soft-delete/archive concept existed at all.
--    Nullable, defaults to NULL (not archived) so every existing row,
--    including everyone's current '__copilot__' thread, is unaffected.
--
-- 2. A partial index on (user_id, archived_at, updated_at) so listing a
--    user's active conversations ordered by recent activity stays fast as
--    the table grows past a handful of rows per user.

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_active
  ON public.ai_conversations (user_id, updated_at DESC)
  WHERE archived_at IS NULL;
