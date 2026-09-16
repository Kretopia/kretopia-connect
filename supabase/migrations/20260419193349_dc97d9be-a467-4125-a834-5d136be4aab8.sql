-- Public bucket for outreach email media (must be publicly readable since URLs are embedded in outbound emails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('outreach-media', 'outreach-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users upload own outreach media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'outreach-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own outreach media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'outreach-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own outreach media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'outreach-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read outreach media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'outreach-media');