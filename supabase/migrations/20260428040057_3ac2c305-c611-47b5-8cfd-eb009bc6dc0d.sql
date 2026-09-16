
-- 1. Track every share click for attribution
CREATE TABLE public.event_share_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  referrer_user_id UUID,
  channel TEXT NOT NULL DEFAULT 'unknown',
  visitor_session TEXT,
  converted_to_rsvp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_share_clicks_event ON public.event_share_clicks(event_id);
CREATE INDEX idx_event_share_clicks_referrer ON public.event_share_clicks(referrer_user_id);

ALTER TABLE public.event_share_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can log a share click
CREATE POLICY "Anyone can log share clicks"
ON public.event_share_clicks FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Referrer can see their own clicks
CREATE POLICY "Referrer can view own share clicks"
ON public.event_share_clicks FOR SELECT
TO authenticated
USING (auth.uid() = referrer_user_id);

-- Event host (and co-hosts) can see all clicks for their event
CREATE POLICY "Host can view event share clicks"
ON public.event_share_clicks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.creative_jams
    WHERE id = event_share_clicks.event_id
    AND created_by = auth.uid()
  )
);

-- 2. Add referred_by to jam_participants for attribution
ALTER TABLE public.jam_participants
  ADD COLUMN IF NOT EXISTS referred_by UUID,
  ADD COLUMN IF NOT EXISTS referral_channel TEXT;

CREATE INDEX IF NOT EXISTS idx_jam_participants_referred_by
  ON public.jam_participants(referred_by);
