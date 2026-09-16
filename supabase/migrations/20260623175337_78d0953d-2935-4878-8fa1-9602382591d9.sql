-- 1) room_knocks ---------------------------------------------------------
CREATE TABLE public.room_knocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  guest_user_id uuid,
  guest_name text NOT NULL,
  guest_email text,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending|accepted|declined|expired
  meeting_id uuid,
  guest_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  share_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);
CREATE INDEX room_knocks_owner_status_idx ON public.room_knocks (owner_id, status, created_at DESC);
CREATE INDEX room_knocks_token_idx ON public.room_knocks (guest_token);

GRANT SELECT, INSERT, UPDATE ON public.room_knocks TO authenticated;
GRANT INSERT ON public.room_knocks TO anon;
GRANT ALL ON public.room_knocks TO service_role;

ALTER TABLE public.room_knocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their knocks"
  ON public.room_knocks FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners update their knocks"
  ON public.room_knocks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Anyone may knock"
  ON public.room_knocks FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(guest_name,'')) BETWEEN 1 AND 80
    AND char_length(coalesce(message,'')) <= 400
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_knocks;

-- Public RPC for guest polling
CREATE OR REPLACE FUNCTION public.get_knock_status(_knock_id uuid, _guest_token text)
RETURNS TABLE (status text, share_url text, meeting_id uuid, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.status, k.share_url, k.meeting_id, k.expires_at
  FROM public.room_knocks k
  WHERE k.id = _knock_id AND k.guest_token = _guest_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_knock_status(uuid, text) TO anon, authenticated;

-- Touch updated_at on update
CREATE OR REPLACE FUNCTION public.touch_room_knocks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_room_knocks_updated_at
  BEFORE UPDATE ON public.room_knocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_room_knocks_updated_at();


-- 2) creator_booking_windows --------------------------------------------
CREATE TABLE public.creator_booking_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  timezone text NOT NULL DEFAULT 'UTC',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);
CREATE INDEX cbw_user_idx ON public.creator_booking_windows (user_id, weekday);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_booking_windows TO authenticated;
GRANT SELECT ON public.creator_booking_windows TO anon;
GRANT ALL ON public.creator_booking_windows TO service_role;

ALTER TABLE public.creator_booking_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their booking windows"
  ON public.creator_booking_windows FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public reads active windows"
  ON public.creator_booking_windows FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER trg_cbw_updated_at
  BEFORE UPDATE ON public.creator_booking_windows
  FOR EACH ROW EXECUTE FUNCTION public.touch_room_knocks_updated_at();


-- 3) profiles toggle -----------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bookings_enabled boolean NOT NULL DEFAULT false;
