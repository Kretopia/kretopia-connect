-- Security: two storage.objects policies are named as if they restrict to
-- service_role, but neither has a `TO service_role` clause -- Postgres
-- policies default to PUBLIC (every role, including anon) when no `TO` is
-- given, so both actually grant to anyone regardless of authentication.
-- The team has already found and fixed this exact anti-pattern once, for
-- discovered_credits' INSERT policy (20260808090000_fix_discovered_credits_insert_rls.sql).
-- Neither fix here changes behavior for the real writer, which already
-- uses the service-role key (bypasses RLS) in both cases -- confirmed by
-- reading supabase/functions/generate-deal-memo/index.ts and the existing
-- separate "Authenticated users can upload opportunity images" policy that
-- already covers the legitimate user-upload path for opportunity covers.

-- deal-memos: only the deal-memo generator (service_role) should ever be
-- able to write into this bucket -- these are binding contract PDFs
-- between two specific named parties.
DROP POLICY IF EXISTS "Service role can write deal memo PDFs" ON storage.objects;
CREATE POLICY "Service role can write deal memo PDFs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'deal-memos');

-- opportunities cover images: the "FOR ALL" policy was meant to let the
-- image-generation edge function manage covers server-side. Without a role
-- restriction it also granted UPDATE/DELETE on any file in the bucket to
-- anon -- a real defacement/deletion vector on marketing imagery.
-- Authenticated user uploads remain covered by the separate,
-- already-correctly-scoped "Authenticated users can upload opportunity
-- images" policy (unchanged).
DROP POLICY IF EXISTS "Service role can manage opportunity images" ON storage.objects;
CREATE POLICY "Service role can manage opportunity images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'opportunities')
WITH CHECK (bucket_id = 'opportunities');
