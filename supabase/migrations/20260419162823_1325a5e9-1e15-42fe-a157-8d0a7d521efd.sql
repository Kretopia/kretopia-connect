
-- Remove blanket public read policies on project-files
DROP POLICY IF EXISTS "Public read access for project-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in their projects" ON storage.objects;

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'project-files';
