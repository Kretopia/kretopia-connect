-- Missed call tracking on direct calls
ALTER TABLE public.direct_video_calls
  ADD COLUMN IF NOT EXISTS was_missed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missed_at timestamptz;

-- RPC to mark a call as missed + notify the receiver
CREATE OR REPLACE FUNCTION public.mark_direct_call_missed(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call public.direct_video_calls%ROWTYPE;
  v_caller_name text;
BEGIN
  SELECT * INTO v_call FROM public.direct_video_calls WHERE id = _call_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_call.started_by <> auth.uid() THEN RETURN; END IF;
  IF v_call.ended_at IS NOT NULL OR v_call.was_missed THEN RETURN; END IF;

  UPDATE public.direct_video_calls
     SET was_missed = true,
         missed_at = now(),
         ended_at = now(),
         duration_seconds = 0
   WHERE id = _call_id;

  SELECT full_name INTO v_caller_name FROM public.profiles WHERE user_id = v_call.started_by;

  IF v_call.invited_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id)
    VALUES (
      v_call.invited_user_id,
      'missed_call',
      'Missed call',
      COALESCE(v_caller_name, 'Someone') || ' tried to reach you',
      '/messages?tab=calls',
      _call_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_direct_call_missed(uuid) TO authenticated;

-- Group calls from a Circle
CREATE TABLE IF NOT EXISTS public.circle_video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  room_url text NOT NULL,
  room_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_video_calls_circle ON public.circle_video_calls(circle_id, started_at DESC);

ALTER TABLE public.circle_video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view circle calls"
  ON public.circle_video_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.spark_room_members
      WHERE room_id = circle_video_calls.circle_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can start circle calls"
  ON public.circle_video_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    started_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.spark_room_members
      WHERE room_id = circle_video_calls.circle_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Starter can update circle call"
  ON public.circle_video_calls FOR UPDATE
  TO authenticated
  USING (started_by = auth.uid());