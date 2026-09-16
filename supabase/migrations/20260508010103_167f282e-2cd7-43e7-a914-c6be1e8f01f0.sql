CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  tier text DEFAULT 'standard',
  contact_name text,
  contact_email text,
  contact_phone text,
  package_value numeric(12,2),
  package_currency text DEFAULT 'USD',
  deliverables text,
  notes text,
  status text NOT NULL DEFAULT 'lead',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage sponsors" ON public.event_sponsors
  FOR ALL USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE INDEX idx_event_sponsors_project ON public.event_sponsors(project_id, status, position);
CREATE TRIGGER trg_event_sponsors_updated BEFORE UPDATE ON public.event_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();