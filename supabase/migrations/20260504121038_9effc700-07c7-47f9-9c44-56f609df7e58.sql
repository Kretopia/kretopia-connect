
ALTER TABLE public.project_video_calls ADD COLUMN IF NOT EXISTS recording_id text;
ALTER TABLE public.direct_video_calls  ADD COLUMN IF NOT EXISTS recording_id text;
ALTER TABLE public.circle_video_calls  ADD COLUMN IF NOT EXISTS recording_id text;
CREATE INDEX IF NOT EXISTS idx_pvc_recording_id ON public.project_video_calls(recording_id);
CREATE INDEX IF NOT EXISTS idx_dvc_recording_id ON public.direct_video_calls(recording_id);
CREATE INDEX IF NOT EXISTS idx_cvc_recording_id ON public.circle_video_calls(recording_id);

CREATE TABLE public.call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_kind text NOT NULL CHECK (call_kind IN ('project','direct','circle')),
  call_id uuid NOT NULL,
  project_id uuid,
  circle_id uuid,
  recording_id text,
  recording_url text,
  duration_seconds integer,
  language text,
  transcript text,
  summary text,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','transcribing','ready','failed')),
  error text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_transcripts_call ON public.call_transcripts(call_kind, call_id);
CREATE INDEX idx_call_transcripts_project ON public.call_transcripts(project_id);
CREATE INDEX idx_call_transcripts_creator ON public.call_transcripts(created_by);

ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_view_call_transcript(_user uuid, _t public.call_transcripts)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _t.created_by = _user
    OR (_t.call_kind = 'project' AND _t.project_id IS NOT NULL
        AND public.user_has_project_access(_t.project_id, _user))
    OR (_t.call_kind = 'direct' AND EXISTS (
        SELECT 1 FROM public.direct_video_calls d
        WHERE d.id = _t.call_id
          AND (_user = d.started_by OR _user = d.invited_user_id)
    ))
    OR (_t.call_kind = 'circle' AND EXISTS (
        SELECT 1 FROM public.circle_video_calls c
        WHERE c.id = _t.call_id AND c.started_by = _user
    ));
$$;

CREATE POLICY "view own/participant transcripts"
  ON public.call_transcripts FOR SELECT
  USING (public.user_can_view_call_transcript(auth.uid(), call_transcripts));

CREATE POLICY "service role manages transcripts"
  ON public.call_transcripts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "creator can update own transcript"
  ON public.call_transcripts FOR UPDATE
  USING (created_by = auth.uid());

CREATE TABLE public.call_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES public.call_transcripts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('task','credit','note','followup','decision')),
  title text NOT NULL,
  detail text,
  assignee_name text,
  assignee_user_id uuid,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','pushed')),
  pushed_to_id uuid,
  pushed_to_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_action_items_transcript ON public.call_action_items(transcript_id);
CREATE INDEX idx_call_action_items_assignee ON public.call_action_items(assignee_user_id);

ALTER TABLE public.call_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view items for accessible transcripts"
  ON public.call_action_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.call_transcripts t
    WHERE t.id = call_action_items.transcript_id
      AND public.user_can_view_call_transcript(auth.uid(), t)
  ));

CREATE POLICY "update items for accessible transcripts"
  ON public.call_action_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.call_transcripts t
    WHERE t.id = call_action_items.transcript_id
      AND public.user_can_view_call_transcript(auth.uid(), t)
  ));

CREATE POLICY "service role manages action items"
  ON public.call_action_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_call_transcripts_updated_at
  BEFORE UPDATE ON public.call_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_action_items_updated_at
  BEFORE UPDATE ON public.call_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
