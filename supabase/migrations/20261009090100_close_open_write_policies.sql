-- ============================================================================
-- Close world-writable policies (audit 2026-10-09, Studio + Passport brief).
-- No new table, no new column, no data change. Idempotent.
--
-- 1. share_link_approvals: "Anyone can submit approval via valid link" had
--    WITH CHECK (true), so any visitor could insert a client approval for any
--    share link (even a view-only or expired one) and any deliverable id. The
--    only legitimate writer is the redeem-project-share edge function, which
--    uses the service role (bypasses RLS) and already enforces: link not
--    revoked/expired, password, can_approve, and that the deliverable/file
--    belongs to the link's project and scope. Members keep read access
--    ("Project members read approvals").
-- 2. share_link_views: same pattern ("Anyone can log a view", WITH CHECK
--    (true)); views are logged by the same edge function through the
--    log_share_link_view RPC (service role).
-- 3. storage.objects "Service role can manage opportunity images": policy
--    named for the service role but granted to PUBLIC with only a bucket
--    check, i.e. an anonymous visitor could upload, overwrite and delete any
--    object in the public `opportunities` bucket. Verified no client code
--    uploads there; signed-in uploads keep "Authenticated users can upload
--    opportunity images".
-- 4. storage.objects "Service role can write deal memo PDFs": INSERT for
--    PUBLIC on the private `deal-memos` bucket, i.e. anyone could plant a
--    file at the path a deal memo PDF will later be read from. Only the
--    generate-deal-memo edge function writes there (service role).
-- 5. storage.objects "Users can delete own media": any signed-in user could
--    delete any object under media/circles/. Now owner-only.
--
-- ROLLBACK: security/rollback-2026-10-09.sql
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.share_link_approvals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can submit approval via valid link" ON public.share_link_approvals;
  END IF;
  IF to_regclass('public.share_link_views') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can log a view" ON public.share_link_views;
  END IF;
END $$;

DROP POLICY IF EXISTS "Service role can manage opportunity images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can write deal memo PDFs" ON storage.objects;

DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
CREATE POLICY "Users can delete own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'circles'
  AND owner = auth.uid()
);
