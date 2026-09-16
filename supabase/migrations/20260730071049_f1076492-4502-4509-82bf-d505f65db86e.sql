CREATE POLICY "Users upload own import files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'import-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own import files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'import-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own import files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'import-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);