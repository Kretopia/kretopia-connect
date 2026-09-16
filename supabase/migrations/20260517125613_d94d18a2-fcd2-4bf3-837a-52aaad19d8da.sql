
-- =====================================================================
-- SOUND STAGES — live rooms (Open Stage)
-- =====================================================================
CREATE TABLE public.sound_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  vibe_tag TEXT,
  mode TEXT NOT NULL DEFAULT 'video' CHECK (mode IN ('video','audio')),
  format TEXT NOT NULL DEFAULT 'open_group' CHECK (format IN ('open_1to1','open_group','audience')),
  room_url TEXT NOT NULL,
  room_name TEXT NOT NULL UNIQUE,
  is_live BOOLEAN NOT NULL DEFAULT true,
  participant_count INT NOT NULL DEFAULT 0,
  circle_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sound_stages_live ON public.sound_stages(is_live, started_at DESC) WHERE is_live = true;
CREATE INDEX idx_sound_stages_host ON public.sound_stages(host_user_id);

ALTER TABLE public.sound_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view sound stages"
  ON public.sound_stages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Host can create their own sound stage"
  ON public.sound_stages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update their own sound stage"
  ON public.sound_stages FOR UPDATE
  TO authenticated USING (auth.uid() = host_user_id);

CREATE POLICY "Host can delete their own sound stage"
  ON public.sound_stages FOR DELETE
  TO authenticated USING (auth.uid() = host_user_id);

-- =====================================================================
-- SPEED SESSIONS — scheduled Hi Right Now style
-- =====================================================================
CREATE TABLE public.speed_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  theme TEXT,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'video' CHECK (mode IN ('video','audio')),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  slot_seconds INT NOT NULL DEFAULT 300,
  match_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','canceled')),
  max_participants INT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_speed_sessions_upcoming ON public.speed_sessions(starts_at) WHERE status IN ('scheduled','live');

ALTER TABLE public.speed_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view speed sessions"
  ON public.speed_sessions FOR SELECT
  TO authenticated USING (true);

-- v1: only admins create speed sessions
CREATE POLICY "Admins can create speed sessions"
  ON public.speed_sessions FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins or host can update speed sessions"
  ON public.speed_sessions FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = host_user_id);

CREATE POLICY "Admins can delete speed sessions"
  ON public.speed_sessions FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_speed_sessions_updated_at
  BEFORE UPDATE ON public.speed_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- SPEED SESSION RSVPS
-- =====================================================================
CREATE TABLE public.speed_session_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.speed_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rsvp' CHECK (status IN ('rsvp','joined','left','no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_speed_rsvps_session ON public.speed_session_rsvps(session_id);
CREATE INDEX idx_speed_rsvps_user ON public.speed_session_rsvps(user_id);

ALTER TABLE public.speed_session_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view RSVPs"
  ON public.speed_session_rsvps FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users manage their own RSVP"
  ON public.speed_session_rsvps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own RSVP"
  ON public.speed_session_rsvps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own RSVP"
  ON public.speed_session_rsvps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- SPEED SESSION PAIRINGS — auto-matched 1:1 rounds
-- =====================================================================
CREATE TABLE public.speed_session_pairings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.speed_sessions(id) ON DELETE CASCADE,
  round INT NOT NULL,
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  room_url TEXT NOT NULL,
  room_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  a_cosigned BOOLEAN NOT NULL DEFAULT false,
  b_cosigned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pairings_session_round ON public.speed_session_pairings(session_id, round);
CREATE INDEX idx_pairings_users ON public.speed_session_pairings(user_a, user_b);

ALTER TABLE public.speed_session_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paired users or host can view pairings"
  ON public.speed_session_pairings FOR SELECT
  TO authenticated USING (
    auth.uid() = user_a
    OR auth.uid() = user_b
    OR EXISTS (
      SELECT 1 FROM public.speed_sessions s
      WHERE s.id = session_id AND s.host_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Paired users can mark their cosign"
  ON public.speed_session_pairings FOR UPDATE
  TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

-- =====================================================================
-- Realtime
-- =====================================================================
ALTER TABLE public.sound_stages REPLICA IDENTITY FULL;
ALTER TABLE public.speed_session_pairings REPLICA IDENTITY FULL;
ALTER TABLE public.speed_session_rsvps REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sound_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.speed_session_pairings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.speed_session_rsvps;
