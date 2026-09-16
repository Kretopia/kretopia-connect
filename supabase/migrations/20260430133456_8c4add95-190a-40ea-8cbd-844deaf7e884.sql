-- Add video room columns to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS video_room_url text,
  ADD COLUMN IF NOT EXISTS video_room_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_room_started_by uuid;

-- Activity log for video calls
CREATE TABLE IF NOT EXISTS public.project_video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  room_url text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_video_calls_project ON public.project_video_calls(project_id, started_at DESC);

ALTER TABLE public.project_video_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project video calls" ON public.project_video_calls;
CREATE POLICY "Members can view project video calls"
ON public.project_video_calls
FOR SELECT
TO authenticated
USING (public.user_has_project_access(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members can insert project video calls" ON public.project_video_calls;
CREATE POLICY "Members can insert project video calls"
ON public.project_video_calls
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_project_access(project_id, auth.uid()) AND started_by = auth.uid());

DROP POLICY IF EXISTS "Members can update project video calls" ON public.project_video_calls;
CREATE POLICY "Members can update project video calls"
ON public.project_video_calls
FOR UPDATE
TO authenticated
USING (public.user_has_project_access(project_id, auth.uid()));