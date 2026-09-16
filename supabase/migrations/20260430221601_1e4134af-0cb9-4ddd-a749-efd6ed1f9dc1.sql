-- Direct (1:1 / ad-hoc) video calls
CREATE TABLE IF NOT EXISTS public.direct_video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name text NOT NULL UNIQUE,
  room_url text NOT NULL,
  started_by uuid NOT NULL,
  invited_user_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_direct_video_calls_started_by ON public.direct_video_calls (started_by, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_video_calls_invited ON public.direct_video_calls (invited_user_id, started_at DESC);

ALTER TABLE public.direct_video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caller can insert direct call"
  ON public.direct_video_calls FOR INSERT TO authenticated
  WITH CHECK (started_by = auth.uid());

CREATE POLICY "Participants can view direct call"
  ON public.direct_video_calls FOR SELECT TO authenticated
  USING (started_by = auth.uid() OR invited_user_id = auth.uid());

CREATE POLICY "Participants can update direct call"
  ON public.direct_video_calls FOR UPDATE TO authenticated
  USING (started_by = auth.uid() OR invited_user_id = auth.uid());

-- Guest invite tokens for video rooms (project + direct)
CREATE TABLE IF NOT EXISTS public.video_call_guest_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  room_name text NOT NULL,
  room_url text NOT NULL,
  project_id uuid,
  direct_call_id uuid,
  created_by uuid NOT NULL,
  guest_label text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_call_guest_tokens_token ON public.video_call_guest_tokens (token);
CREATE INDEX IF NOT EXISTS idx_video_call_guest_tokens_project ON public.video_call_guest_tokens (project_id);

ALTER TABLE public.video_call_guest_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator can view their guest tokens"
  ON public.video_call_guest_tokens FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creator can insert guest tokens"
  ON public.video_call_guest_tokens FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
