
-- Create storage bucket for opportunity cover images
INSERT INTO storage.buckets (id, name, public) VALUES ('opportunities', 'opportunities', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Opportunity images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'opportunities');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload opportunity images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'opportunities' AND auth.role() = 'authenticated');

-- Allow service role to upload (for edge functions)
CREATE POLICY "Service role can manage opportunity images"
ON storage.objects FOR ALL
USING (bucket_id = 'opportunities')
WITH CHECK (bucket_id = 'opportunities');
