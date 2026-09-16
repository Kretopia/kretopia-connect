ALTER TABLE public.call_transcripts
  ADD COLUMN IF NOT EXISTS highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS co_sign_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS live_captions jsonb NOT NULL DEFAULT '[]'::jsonb;