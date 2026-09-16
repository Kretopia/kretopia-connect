ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS voice_duration integer,
  ADD COLUMN IF NOT EXISTS voice_transcript text;