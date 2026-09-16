-- Drop the policy
DROP POLICY IF EXISTS "Users can upload own portfolio files" ON storage.objects;

-- Recreate with correct role (public, not authenticated)
CREATE POLICY "Users can upload own portfolio files"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);