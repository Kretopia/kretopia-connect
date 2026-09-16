-- Ensure project-files bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'project-files';

-- Add public SELECT policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public read access for project-files'
  ) THEN
    CREATE POLICY "Public read access for project-files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'project-files');
  END IF;
END $$;