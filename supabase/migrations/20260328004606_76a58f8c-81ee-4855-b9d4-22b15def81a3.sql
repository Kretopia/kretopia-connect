INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Anyone can view media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'media');

CREATE POLICY "Users can delete own media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = 'circles');