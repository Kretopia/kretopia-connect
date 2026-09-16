
CREATE TABLE IF NOT EXISTS public.guest_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'going',
  check_in_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, guest_email)
);

CREATE INDEX IF NOT EXISTS idx_guest_rsvps_event ON public.guest_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_rsvps_email ON public.guest_rsvps(guest_email);

ALTER TABLE public.guest_rsvps ENABLE ROW LEVEL SECURITY;

-- Anyone can create a guest RSVP (public RSVP flow, no auth required)
CREATE POLICY "Anyone can create guest RSVP"
ON public.guest_rsvps
FOR INSERT
WITH CHECK (true);

-- Event host can view RSVPs for their events
CREATE POLICY "Host can view guest RSVPs"
ON public.guest_rsvps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.creative_jams j
    WHERE j.id = guest_rsvps.event_id
      AND j.created_by = auth.uid()
  )
);

-- Admins can view all
CREATE POLICY "Admins can view all guest RSVPs"
ON public.guest_rsvps
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Host can update (e.g. mark checked in)
CREATE POLICY "Host can update guest RSVPs"
ON public.guest_rsvps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.creative_jams j
    WHERE j.id = guest_rsvps.event_id
      AND j.created_by = auth.uid()
  )
);

CREATE TRIGGER update_guest_rsvps_updated_at
BEFORE UPDATE ON public.guest_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
