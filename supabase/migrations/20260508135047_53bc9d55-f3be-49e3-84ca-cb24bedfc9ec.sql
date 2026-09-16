
-- Helper: check if current user is owner or accepted collaborator on a project
-- Reuse existing pattern: many studio tables use is_project_member or inline checks.
-- We'll inline the check via projects + project_collaborators.

CREATE TABLE public.content_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  scene_no int,
  shot_no int,
  description text NOT NULL,
  shot_type text,
  location text,
  talent text[] DEFAULT '{}',
  props text[] DEFAULT '{}',
  duration_seconds int,
  status text NOT NULL DEFAULT 'planned',
  order_index int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.content_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  updated_by uuid,
  title text NOT NULL DEFAULT 'Script',
  body text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.content_calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  platform text,
  scheduled_at timestamptz,
  caption text,
  hashtags text[] DEFAULT '{}',
  asset_url text,
  status text NOT NULL DEFAULT 'idea',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.content_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  item_type text NOT NULL DEFAULT 'post',
  item_id uuid,
  asset_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  decided_at timestamptz,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_shots_project ON public.content_shots(project_id, order_index);
CREATE INDEX idx_content_scripts_project ON public.content_scripts(project_id, is_current);
CREATE INDEX idx_content_calendar_project ON public.content_calendar_items(project_id, scheduled_at);
CREATE INDEX idx_content_approvals_project ON public.content_approvals(project_id, status);

ALTER TABLE public.content_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_approvals ENABLE ROW LEVEL SECURITY;

-- Reusable membership check via SECURITY DEFINER function (avoid recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = _project_id AND pc.user_id = _user_id AND pc.status = 'accepted'
  );
$$;

-- Generic policies for all four tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_shots','content_scripts','content_calendar_items','content_approvals']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "members can view %1$s"
      ON public.%1$I FOR SELECT
      USING (public.is_project_member(project_id, auth.uid()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "members can insert %1$s"
      ON public.%1$I FOR INSERT
      WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "members can update %1$s"
      ON public.%1$I FOR UPDATE
      USING (public.is_project_member(project_id, auth.uid()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "members can delete %1$s"
      ON public.%1$I FOR DELETE
      USING (public.is_project_member(project_id, auth.uid()));
    $f$, t);
  END LOOP;
END $$;

-- updated_at triggers
CREATE TRIGGER trg_content_shots_updated BEFORE UPDATE ON public.content_shots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_content_scripts_updated BEFORE UPDATE ON public.content_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_content_calendar_updated BEFORE UPDATE ON public.content_calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_content_approvals_updated BEFORE UPDATE ON public.content_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
