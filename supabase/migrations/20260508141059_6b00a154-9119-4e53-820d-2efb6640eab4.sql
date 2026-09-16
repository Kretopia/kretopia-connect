
CREATE TABLE public.music_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  release_type TEXT NOT NULL DEFAULT 'single', -- single | ep | album
  release_date DATE,
  distributor TEXT,
  isrc TEXT,
  upc TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | released
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_music_releases_project ON public.music_releases(project_id);

CREATE TABLE public.music_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.music_releases(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  track_no INT,
  title TEXT NOT NULL,
  duration_seconds INT,
  isrc TEXT,
  lyrics TEXT,
  status TEXT NOT NULL DEFAULT 'idea', -- idea | recorded | mixed | mastered | final
  master_url TEXT,
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_music_tracks_project ON public.music_tracks(project_id, order_index);
CREATE INDEX idx_music_tracks_release ON public.music_tracks(release_id);

CREATE TABLE public.music_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.music_releases(id) ON DELETE CASCADE,
  track_id UUID REFERENCES public.music_tracks(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  collaborator_user_id UUID,
  name TEXT NOT NULL,
  role TEXT, -- songwriter | producer | performer | featured | engineer
  percentage NUMERIC NOT NULL DEFAULT 0,
  payout_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | agreed | declined
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_music_splits_project ON public.music_splits(project_id);
CREATE INDEX idx_music_splits_track ON public.music_splits(track_id);

CREATE TABLE public.music_release_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.music_releases(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_music_checklist_project ON public.music_release_checklist(project_id, order_index);

ALTER TABLE public.music_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_release_checklist ENABLE ROW LEVEL SECURITY;

-- Reuse is_project_member SECURITY DEFINER
DO $$ BEGIN
  PERFORM 1;
END $$;

CREATE POLICY "Members read music_releases" ON public.music_releases FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write music_releases" ON public.music_releases FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update music_releases" ON public.music_releases FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete music_releases" ON public.music_releases FOR DELETE USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members read music_tracks" ON public.music_tracks FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write music_tracks" ON public.music_tracks FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update music_tracks" ON public.music_tracks FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete music_tracks" ON public.music_tracks FOR DELETE USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members read music_splits" ON public.music_splits FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write music_splits" ON public.music_splits FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update music_splits" ON public.music_splits FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete music_splits" ON public.music_splits FOR DELETE USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members read music_checklist" ON public.music_release_checklist FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write music_checklist" ON public.music_release_checklist FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update music_checklist" ON public.music_release_checklist FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members delete music_checklist" ON public.music_release_checklist FOR DELETE USING (public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER trg_music_releases_updated BEFORE UPDATE ON public.music_releases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_music_tracks_updated BEFORE UPDATE ON public.music_tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_music_splits_updated BEFORE UPDATE ON public.music_splits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_music_checklist_updated BEFORE UPDATE ON public.music_release_checklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
