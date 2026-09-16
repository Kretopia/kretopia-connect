-- Link events <-> Studios (projects)
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.creative_jams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creative_jams_project_id ON public.creative_jams(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_event_id ON public.projects(event_id);

-- Keep the back-reference in sync: when projects.event_id is set, mirror to creative_jams.project_id
CREATE OR REPLACE FUNCTION public.sync_project_event_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND (OLD IS NULL OR OLD.event_id IS DISTINCT FROM NEW.event_id) THEN
    UPDATE public.creative_jams
       SET project_id = NEW.id
     WHERE id = NEW.event_id
       AND (project_id IS DISTINCT FROM NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_event_link ON public.projects;
CREATE TRIGGER trg_sync_project_event_link
AFTER INSERT OR UPDATE OF event_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_event_link();