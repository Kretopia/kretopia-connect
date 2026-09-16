
-- Speed Session public share + reminder tracking

ALTER TABLE public.speed_sessions
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Allow anonymous visitors to read scheduled/live sessions so public share links work.
GRANT SELECT ON public.speed_sessions TO anon;

DROP POLICY IF EXISTS "Public can view speed sessions" ON public.speed_sessions;
CREATE POLICY "Public can view speed sessions"
ON public.speed_sessions
FOR SELECT
TO anon
USING (status IN ('scheduled','live','ended'));
