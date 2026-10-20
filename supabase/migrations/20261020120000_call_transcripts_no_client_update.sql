-- M5 (docs/roadmap/schema-impact-report.md): call_transcripts had a "creator can update own transcript" policy
-- and UPDATE on all 25 columns for anon and authenticated, so a creator could rewrite recording_id, project_id,
-- created_by or the transcript itself on their own row. Only the service role writes this table (edge functions)
-- and the frontend never updates it, so the client UPDATE path is removed. SELECT, the service-role policy and the
-- edge writers are untouched; realtime UPDATE events keep reaching subscribers (they depend on SELECT).
-- Applied to production on 2026-10-20 with approval; this file records it so the migrations match.
-- Rollback: GRANT UPDATE ON public.call_transcripts TO anon, authenticated;
--           CREATE POLICY "creator can update own transcript" ON public.call_transcripts FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "creator can update own transcript" ON public.call_transcripts;
REVOKE UPDATE ON public.call_transcripts FROM anon, authenticated;
