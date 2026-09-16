
INSERT INTO storage.buckets (id, name, public)
VALUES ('location-images', 'location-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view location images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'location-images');

CREATE POLICY "Authenticated users can upload location images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'location-images');

CREATE POLICY "Users can delete own location images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'location-images' AND (storage.foldername(name))[1] = auth.uid()::text);
