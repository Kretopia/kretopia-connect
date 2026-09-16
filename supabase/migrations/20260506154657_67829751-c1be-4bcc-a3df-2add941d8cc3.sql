
-- Phase 2: Podcast deepening
CREATE TABLE IF NOT EXISTS public.episode_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sponsor_name text NOT NULL,
  contact_email text,
  amount numeric,
  currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pitched' CHECK (status IN ('pitched','negotiating','booked','paid','declined')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.episode_sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage episode sponsors" ON public.episode_sponsors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = p.id AND pc.user_id = auth.uid())))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = p.id AND pc.user_id = auth.uid())))
  );
CREATE INDEX idx_episode_sponsors_episode ON public.episode_sponsors(episode_id);

CREATE TABLE IF NOT EXISTS public.episode_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  transcript_excerpt text,
  start_seconds int,
  end_seconds int,
  captions jsonb DEFAULT '{}'::jsonb, -- { instagram, tiktok, x, youtube }
  hashtags text[] DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.episode_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage clips" ON public.episode_clips
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = p.id AND pc.user_id = auth.uid())))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = p.id AND pc.user_id = auth.uid())))
  );
CREATE INDEX idx_episode_clips_episode ON public.episode_clips(episode_id);

-- Add transcript + audio columns to podcast_episodes if missing
ALTER TABLE public.podcast_episodes 
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS show_notes text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Phase 3: Event Studio runsheet
CREATE TABLE IF NOT EXISTS public.event_runsheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_time time,
  end_time time,
  title text NOT NULL,
  owner_name text,
  notes text,
  position int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','at_risk')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_runsheet_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage runsheet" ON public.event_runsheet_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = p.id AND pc.user_id = auth.uid())))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id = p.id AND pc.user_id = auth.uid())))
  );
CREATE INDEX idx_event_runsheet_project ON public.event_runsheet_items(project_id, position);

-- Phase 6: telemetry on routed intents
CREATE TABLE IF NOT EXISTS public.thrive_intent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  intent text NOT NULL,
  workspace_type text,
  routed_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.thrive_intent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own intent logs" ON public.thrive_intent_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own intent logs" ON public.thrive_intent_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_thrive_intent_logs_user ON public.thrive_intent_logs(user_id, created_at DESC);

-- Updated-at trigger reuse
CREATE TRIGGER trg_episode_sponsors_updated BEFORE UPDATE ON public.episode_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_event_runsheet_updated BEFORE UPDATE ON public.event_runsheet_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
