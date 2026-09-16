
-- ============================================================
-- STUDIO BRAIN — Phase B foundation
-- ============================================================

CREATE TABLE public.studio_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT,
  value TEXT,
  value_numeric NUMERIC,
  value_date DATE,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_file_id UUID,
  source_url TEXT,
  source_excerpt TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX studio_facts_project_idx ON public.studio_facts(project_id, importance DESC, created_at DESC);
CREATE INDEX studio_facts_kind_idx ON public.studio_facts(project_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_facts TO authenticated;
GRANT ALL ON public.studio_facts TO service_role;

ALTER TABLE public.studio_facts ENABLE ROW LEVEL SECURITY;

-- Members of the project (owner or collaborator) can read/write facts.
CREATE POLICY "Project members read studio_facts"
  ON public.studio_facts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_facts.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Project members write studio_facts"
  ON public.studio_facts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_facts.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Project members update studio_facts"
  ON public.studio_facts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_facts.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Project members delete studio_facts"
  ON public.studio_facts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_facts.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

-- ============================================================

CREATE TABLE public.studio_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_file_id UUID,
  source_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, kind, slug)
);

CREATE INDEX studio_entities_project_idx ON public.studio_entities(project_id, kind, importance DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_entities TO authenticated;
GRANT ALL ON public.studio_entities TO service_role;

ALTER TABLE public.studio_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members read studio_entities"
  ON public.studio_entities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_entities.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Project members write studio_entities"
  ON public.studio_entities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_entities.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Project members update studio_entities"
  ON public.studio_entities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_entities.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Project members delete studio_entities"
  ON public.studio_entities FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = studio_entities.project_id
        AND (p.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.project_collaborators c
               WHERE c.project_id = p.id AND c.user_id = auth.uid()
             ))
    )
  );

-- Updated-at triggers (reuse existing helper)
CREATE TRIGGER trg_studio_facts_updated_at
  BEFORE UPDATE ON public.studio_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_studio_entities_updated_at
  BEFORE UPDATE ON public.studio_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
