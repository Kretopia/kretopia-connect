
-- Create bucket if missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-photos', 'event-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Event photos are publicly readable" ON storage.objects;
CREATE POLICY "Event photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-photos');

-- Authenticated users can upload to {event_id}/{their user_id}/...
DROP POLICY IF EXISTS "Authenticated users can upload event photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload event photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Owners can delete their photos
DROP POLICY IF EXISTS "Users can delete their own event photos" ON storage.objects;
CREATE POLICY "Users can delete their own event photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
