-- messages: the receiver of a direct message may mark it read or unread, nothing else.
--
-- READ BEFORE APPLYING. Not applied by anyone: this file is a reviewed proposal in a PR.
-- Check production first with the read-only queries in
-- docs/security-compliance/p0-fixes-2026-11-13.md (section "Messages").
--
-- Why
--   * The UPDATE policy "Users can update messages they received" (20250930141941) has
--     USING (auth.uid() = receiver_id) and no column limit. The receiver could therefore rewrite
--     the text of a message someone else sent them, its attachments, its reply quote, or point
--     sender_id at a third person, and the conversation would show words that person never wrote.
--   * The app only ever sends { read: true } (DirectMessageDialog, MessagesDialog,
--     pages/messages/useChatMessages). Voice-note transcripts are written by
--     transcribe-voice-note with the service role.
--
-- What
--   1. Column privilege: the API roles may UPDATE only the column read.
--   2. Belt and braces, whatever the grants drift to: a BEFORE UPDATE trigger refuses, for the API
--      roles, any change other than read (updated_at is maintained by update_messages_updated_at).
--      It compares whole rows, so columns production has and this repository does not know about
--      are protected too.
--   current_user, not auth.role(): the service role, the SQL editor and SECURITY DEFINER functions
--   (current_user is the function owner) are not affected.
--
-- Not changed: the policies, existing rows, SELECT/INSERT/DELETE. No user data is altered.
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_messages_receiver_updates_read_state_only ON public.messages;
--   DROP FUNCTION IF EXISTS public.messages_receiver_updates_read_state_only();
--   GRANT UPDATE ON public.messages TO authenticated;

REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read) ON public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.messages_receiver_updates_read_state_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (to_jsonb(NEW) - 'read' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'read' - 'updated_at')
  THEN
    RAISE EXCEPTION 'Only the read state of a message can be changed'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_receiver_updates_read_state_only ON public.messages;
CREATE TRIGGER trg_messages_receiver_updates_read_state_only
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_receiver_updates_read_state_only();
