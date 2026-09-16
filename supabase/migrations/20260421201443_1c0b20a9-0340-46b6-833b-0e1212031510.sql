
-- Add public site fields to spark_rooms (Circles)
ALTER TABLE public.spark_rooms
  ADD COLUMN IF NOT EXISTS site_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_slug text,
  ADD COLUMN IF NOT EXISTS site_template text DEFAULT 'bold-electric',
  ADD COLUMN IF NOT EXISTS site_headline text,
  ADD COLUMN IF NOT EXISTS site_bio text,
  ADD COLUMN IF NOT EXISTS site_about text,
  ADD COLUMN IF NOT EXISTS site_accent_color text DEFAULT '#7B61FF',
  ADD COLUMN IF NOT EXISTS site_logo_url text,
  ADD COLUMN IF NOT EXISTS site_cover_url text,
  ADD COLUMN IF NOT EXISTS site_custom_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS site_show_past_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS site_show_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS site_guest_rsvp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS site_view_count integer NOT NULL DEFAULT 0;

-- Unique slug (case-insensitive), only when set
CREATE UNIQUE INDEX IF NOT EXISTS idx_spark_rooms_site_slug
  ON public.spark_rooms (LOWER(site_slug)) WHERE site_slug IS NOT NULL;

-- Allow public read of published Circle sites
DROP POLICY IF EXISTS "Public sites are viewable by anyone" ON public.spark_rooms;
CREATE POLICY "Public sites are viewable by anyone"
  ON public.spark_rooms FOR SELECT
  USING (site_enabled = true);

-- Guest RSVPs table
CREATE TABLE IF NOT EXISTS public.circle_guest_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  confirm_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  confirmed_at timestamptz,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_circle_guest_rsvps_event ON public.circle_guest_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_circle_guest_rsvps_circle ON public.circle_guest_rsvps(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_guest_rsvps_token ON public.circle_guest_rsvps(confirm_token);

ALTER TABLE public.circle_guest_rsvps ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an RSVP (guests by definition aren't authed)
CREATE POLICY "Anyone can create a guest RSVP"
  ON public.circle_guest_rsvps FOR INSERT
  WITH CHECK (true);

-- Circle owner / admins can view all RSVPs for their circles
CREATE POLICY "Circle owners can view RSVPs for their circles"
  ON public.circle_guest_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.spark_rooms sr
      WHERE sr.id = circle_guest_rsvps.circle_id
        AND sr.created_by = auth.uid()
    )
  );

-- The user (after magic-link confirm assigns user_id) can view their own RSVPs
CREATE POLICY "Users can view their own RSVPs"
  ON public.circle_guest_rsvps FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_circle_guest_rsvps_updated_at ON public.circle_guest_rsvps;
CREATE TRIGGER update_circle_guest_rsvps_updated_at
  BEFORE UPDATE ON public.circle_guest_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
