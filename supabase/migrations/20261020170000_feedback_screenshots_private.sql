-- M9 (docs/roadmap/schema-impact-report.md): the feedback-screenshots bucket was public (anyone could read any
-- object), had no size or type limit, and nothing in the app uploads to it. It is now private; only the uploader
-- (their own folder) and admins can read; files are capped at 5 MB and must be images. The upload policy
-- ("Users can upload feedback screenshots", own folder only) is unchanged. The bucket was empty when this was applied.
-- The size and type limits are enforced by the Storage API on upload, not by row-level security.
-- Applied to production on 2026-10-20 with approval; this file records it so the migrations match.
-- Rollback: UPDATE storage.buckets SET public = true, file_size_limit = NULL, allowed_mime_types = NULL WHERE id = 'feedback-screenshots';
--           DROP POLICY "Uploaders and admins can view feedback screenshots" ON storage.objects;
--           CREATE POLICY "Anyone can view feedback screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'feedback-screenshots');

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id = 'feedback-screenshots';

DROP POLICY IF EXISTS "Anyone can view feedback screenshots" ON storage.objects;

DROP POLICY IF EXISTS "Uploaders and admins can view feedback screenshots" ON storage.objects;
CREATE POLICY "Uploaders and admins can view feedback screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feedback-screenshots'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);
