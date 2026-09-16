-- Drop existing policy
DROP POLICY IF EXISTS "Users can upload own portfolio files" ON storage.objects;

-- Create updated policy with better type handling
CREATE POLICY "Users can upload own portfolio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);