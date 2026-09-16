
ALTER TABLE public.call_transcripts DROP CONSTRAINT IF EXISTS call_transcripts_call_kind_check;
ALTER TABLE public.call_transcripts ADD CONSTRAINT call_transcripts_call_kind_check
  CHECK (call_kind = ANY (ARRAY['project','direct','circle','meeting','event','sound_stage','speed_session','curated_stage']));

ALTER TABLE public.call_transcripts
  ADD COLUMN IF NOT EXISTS chapters jsonb NOT NULL DEFAULT '[]'::jsonb;
