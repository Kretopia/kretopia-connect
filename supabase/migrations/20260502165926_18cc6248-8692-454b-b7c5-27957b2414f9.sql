-- Cork Board: visual sticky notes + image pins for the studio Pad
CREATE TABLE IF NOT EXISTS public.project_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sticky' CHECK (kind IN ('sticky','image','link')),
  content TEXT,
  image_url TEXT,
  color TEXT NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow','pink','mint','sky','lavender','peach')),
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  rotation REAL NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 1,
  generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_pins_project_idx ON public.project_pins(project_id);

ALTER TABLE public.project_pins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user can access a project (owner or collaborator)
CREATE OR REPLACE FUNCTION public.can_access_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_collaborators c
    WHERE c.project_id = _project_id AND c.user_id = _user_id AND c.status = 'accepted'
  );
$$;

CREATE POLICY "pins_select_members"
  ON public.project_pins FOR SELECT TO authenticated
  USING (public.can_access_project(project_id, auth.uid()));

CREATE POLICY "pins_insert_members"
  ON public.project_pins FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_access_project(project_id, auth.uid()));

CREATE POLICY "pins_update_members"
  ON public.project_pins FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id, auth.uid()))
  WITH CHECK (public.can_access_project(project_id, auth.uid()));

CREATE POLICY "pins_delete_members"
  ON public.project_pins FOR DELETE TO authenticated
  USING (public.can_access_project(project_id, auth.uid()));

CREATE TRIGGER trg_project_pins_updated
BEFORE UPDATE ON public.project_pins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_pins;