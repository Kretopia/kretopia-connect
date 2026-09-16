
ALTER TABLE public.speed_sessions
  ADD COLUMN IF NOT EXISTS fallback_mode text NOT NULL DEFAULT 'pair',
  ADD COLUMN IF NOT EXISTS pool_cutoff_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reminders_sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS group_room_url text;

ALTER TABLE public.speed_session_pairings
  ADD COLUMN IF NOT EXISTS ended_reason text;

CREATE TABLE IF NOT EXISTS public.speed_lobby_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.speed_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'two_truths',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speed_lobby_games TO authenticated;
GRANT ALL ON public.speed_lobby_games TO service_role;

ALTER TABLE public.speed_lobby_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lobby games visible to session RSVPs"
  ON public.speed_lobby_games FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.speed_session_rsvps r
      WHERE r.session_id = speed_lobby_games.session_id
        AND r.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.speed_sessions s
      WHERE s.id = speed_lobby_games.session_id
        AND s.host_user_id = auth.uid()
    )
  );

CREATE POLICY "Lobby games insert by RSVP"
  ON public.speed_lobby_games FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.speed_session_rsvps r
      WHERE r.session_id = speed_lobby_games.session_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Lobby games update own"
  ON public.speed_lobby_games FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Lobby games delete own"
  ON public.speed_lobby_games FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER speed_lobby_games_set_updated_at
  BEFORE UPDATE ON public.speed_lobby_games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.speed_lobby_games;
