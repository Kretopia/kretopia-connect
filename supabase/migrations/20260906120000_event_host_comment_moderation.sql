-- Deadline Day P0 fix: event hosts could not actually delete other
-- participants' comments on their own event, despite EventComments.tsx
-- showing them a delete button for exactly that (`isCreator` check,
-- src/components/sessions/EventComments.tsx:254). The event_comments
-- DELETE policy was author-only (auth.uid() = user_id), added in
-- 20260327014406_..., with no host exception ever added since.
--
-- Because a delete filtered out entirely by RLS matches zero rows rather
-- than raising a Postgres error, the host's click silently took the
-- client's success path: the comment vanished from local state but was
-- still in the database, and reappeared on the next reload or the next
-- realtime-triggered refresh from anyone else's activity in the thread.
-- See DEADLINE_DAY_EVENTS_AND_UX_AUDIT.md section F.1.

DROP POLICY IF EXISTS "Users can delete own comments" ON public.event_comments;

CREATE POLICY "Users can delete own comments or event host can moderate"
  ON public.event_comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.creative_jams j
      WHERE j.id = event_comments.event_id AND j.created_by = auth.uid()
    )
  );
