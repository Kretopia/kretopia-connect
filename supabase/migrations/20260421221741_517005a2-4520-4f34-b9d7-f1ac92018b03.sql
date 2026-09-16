-- Private bucket for dispute evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispute-evidence',
  'dispute-evidence',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Users upload to their own folder: {user_id}/{filename}
CREATE POLICY "Users upload own dispute evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own dispute evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own dispute evidence"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dispute-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins view all dispute evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Track evidence file paths on the dispute
ALTER TABLE public.credit_claim_disputes
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}'::text[];