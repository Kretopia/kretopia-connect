-- Make project-files bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'project-files';