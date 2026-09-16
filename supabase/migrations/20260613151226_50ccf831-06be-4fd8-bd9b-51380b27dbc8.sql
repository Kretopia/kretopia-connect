
ALTER TABLE public.speed_sessions
  ADD COLUMN IF NOT EXISTS vertical text NOT NULL DEFAULT 'open';

DO $$ BEGIN
  ALTER TABLE public.speed_sessions
    ADD CONSTRAINT speed_sessions_vertical_check
    CHECK (vertical IN ('open','producers_singers','filmmakers','content_creators','artists','photographers','dancers','writers','designers','models'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_speed_sessions_vertical
  ON public.speed_sessions(vertical, starts_at)
  WHERE status IN ('scheduled','live');
