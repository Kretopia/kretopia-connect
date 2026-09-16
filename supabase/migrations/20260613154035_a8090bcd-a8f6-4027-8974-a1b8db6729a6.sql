
ALTER TABLE public.speed_sessions
  ADD COLUMN IF NOT EXISTS canceled_reason text,
  ADD COLUMN IF NOT EXISTS recap_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_speed_sessions_recap
  ON public.speed_sessions (status, starts_at)
  WHERE recap_sent_at IS NULL;
