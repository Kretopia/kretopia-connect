
-- ============================================
-- CRITICAL SECURITY FIX 1: Profiles anon exposure
-- ============================================
-- Drop the blanket anon SELECT policy that exposed phone_otp, stripe ids, claim tokens, etc.
DROP POLICY IF EXISTS "Public discovery via safe view" ON public.profiles;

-- Anon users can no longer read raw profiles. Public discovery must use public_profiles_safe view.
-- Ensure the safe view is readable by anon (it already excludes sensitive columns).
GRANT SELECT ON public.public_profiles_safe TO anon, authenticated;

-- ============================================
-- CRITICAL SECURITY FIX 2: Realtime channel authorization
-- ============================================
-- Lock down realtime.messages so users can only subscribe to channels they own
-- (their own user-id namespace). Project/circle channels still authorize via app-side
-- broadcast filters; this prevents cross-user firehose subscriptions.
CREATE POLICY "Authenticated can read own channel messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow if topic includes the user's id, or is a public broadcast topic.
  (realtime.topic() LIKE '%' || auth.uid()::text || '%')
  OR (realtime.topic() LIKE 'public:%')
);

CREATE POLICY "Authenticated can write to own channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE '%' || auth.uid()::text || '%')
  OR (realtime.topic() LIKE 'public:%')
);

-- ============================================
-- HIGH SECURITY FIX 3: Lock down public storage buckets
-- ============================================
UPDATE storage.buckets SET public = false WHERE id IN ('board-assets','outreach-media');

-- board-assets: project members only (path: <project_id>/<file>)
DROP POLICY IF EXISTS "Public read board-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read board-assets" ON storage.objects;

CREATE POLICY "Project members can read board-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'board-assets'
  AND public.user_has_project_access(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- outreach-media: owner only (path: <user_id>/<file>)
DROP POLICY IF EXISTS "Public read outreach-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read outreach-media" ON storage.objects;

CREATE POLICY "Owner can read outreach-media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'outreach-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
