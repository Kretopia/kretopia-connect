
-- =============== 1. INTEGRATION CONNECTIONS ===============
CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  provider_account_id text,
  provider_account_name text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expiry timestamptz,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  connection_status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own integration connections"
  ON public.integration_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX idx_integration_conn_unique
  ON public.integration_connections (user_id, provider, coalesce(provider_account_id, ''))
  WHERE revoked_at IS NULL;

-- =============== 2. IMPORT JOBS ===============
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  source_name text,
  source_type text,
  scope_selection jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  progress_percentage integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  processed_items integer NOT NULL DEFAULT 0,
  successful_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  skipped_items integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_summary text,
  upload_path text,
  preview jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or project member can read import jobs"
  ON public.import_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (project_id IS NOT NULL AND public.user_has_project_access(project_id, auth.uid())));
CREATE POLICY "Users create own import jobs"
  ON public.import_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own import jobs"
  ON public.import_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own import jobs"
  ON public.import_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_import_jobs_user ON public.import_jobs (user_id, created_at DESC);
CREATE INDEX idx_import_jobs_project ON public.import_jobs (project_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs (status) WHERE status IN ('queued','running');

-- helper: can current user see a given import job
CREATE OR REPLACE FUNCTION public.can_access_import_job(_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.import_jobs j
    WHERE j.id = _job_id
      AND (j.user_id = auth.uid()
           OR (j.project_id IS NOT NULL AND public.user_has_project_access(j.project_id, auth.uid())))
  )
$$;

-- =============== 3. IMPORT SOURCE OBJECTS ===============
CREATE TABLE public.import_source_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_object_id text NOT NULL,
  external_parent_id text,
  external_object_type text NOT NULL,
  external_url text,
  external_author_id text,
  external_author_name text,
  title text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  import_status text NOT NULL DEFAULT 'pending',
  destination_table text,
  destination_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_source_objects TO authenticated;
GRANT ALL ON public.import_source_objects TO service_role;
ALTER TABLE public.import_source_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access import source objects via job"
  ON public.import_source_objects FOR ALL TO authenticated
  USING (public.can_access_import_job(import_job_id))
  WITH CHECK (public.can_access_import_job(import_job_id));
CREATE UNIQUE INDEX idx_import_src_unique
  ON public.import_source_objects (import_job_id, external_object_id, external_object_type);
CREATE INDEX idx_import_src_status ON public.import_source_objects (import_job_id, import_status);

-- =============== 4. IMPORT MAPPINGS ===============
CREATE TABLE public.import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  source_field text NOT NULL,
  source_type text NOT NULL,
  destination_field text,
  destination_type text,
  transformation_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  user_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_mappings TO authenticated;
GRANT ALL ON public.import_mappings TO service_role;
ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access import mappings via job"
  ON public.import_mappings FOR ALL TO authenticated
  USING (public.can_access_import_job(import_job_id))
  WITH CHECK (public.can_access_import_job(import_job_id));
CREATE INDEX idx_import_mappings_job ON public.import_mappings (import_job_id);

-- =============== 5. IMPORT AUDIT LOG ===============
CREATE TABLE public.import_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  action text NOT NULL,
  source_object_id uuid,
  destination_table text,
  destination_object_id uuid,
  result text NOT NULL DEFAULT 'ok',
  error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.import_audit_log TO authenticated;
GRANT ALL ON public.import_audit_log TO service_role;
ALTER TABLE public.import_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read import audit via job"
  ON public.import_audit_log FOR SELECT TO authenticated
  USING (public.can_access_import_job(import_job_id));
CREATE INDEX idx_import_audit_job ON public.import_audit_log (import_job_id, created_at DESC);

-- =============== 6. IMPORT SUGGESTIONS (Kreto) ===============
CREATE TABLE public.import_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_object_id uuid REFERENCES public.import_source_objects(id) ON DELETE SET NULL,
  source_url text,
  confidence numeric,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  destination_table text,
  destination_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_suggestions TO authenticated;
GRANT ALL ON public.import_suggestions TO service_role;
ALTER TABLE public.import_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access import suggestions via job"
  ON public.import_suggestions FOR ALL TO authenticated
  USING (public.can_access_import_job(import_job_id))
  WITH CHECK (public.can_access_import_job(import_job_id));
CREATE INDEX idx_import_suggestions_job ON public.import_suggestions (import_job_id, status);

-- =============== 7. PROVENANCE ON EXISTING STUDIO TABLES ===============
ALTER TABLE public.project_tasks
  ADD COLUMN import_job_id uuid,
  ADD COLUMN source_provider text,
  ADD COLUMN external_id text,
  ADD COLUMN external_url text,
  ADD COLUMN imported_at timestamptz;

ALTER TABLE public.milestones
  ADD COLUMN import_job_id uuid,
  ADD COLUMN source_provider text,
  ADD COLUMN external_id text,
  ADD COLUMN external_url text,
  ADD COLUMN imported_at timestamptz;

ALTER TABLE public.project_files
  ADD COLUMN import_job_id uuid,
  ADD COLUMN source_provider text,
  ADD COLUMN external_id text,
  ADD COLUMN external_url text,
  ADD COLUMN imported_at timestamptz;

ALTER TABLE public.project_notes
  ADD COLUMN import_job_id uuid,
  ADD COLUMN source_provider text,
  ADD COLUMN external_id text,
  ADD COLUMN external_url text,
  ADD COLUMN imported_at timestamptz,
  ADD COLUMN is_read_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.project_deliverables
  ADD COLUMN import_job_id uuid,
  ADD COLUMN source_provider text,
  ADD COLUMN external_id text,
  ADD COLUMN external_url text,
  ADD COLUMN imported_at timestamptz;

ALTER TABLE public.project_messages
  ADD COLUMN import_job_id uuid,
  ADD COLUMN source_provider text,
  ADD COLUMN external_id text,
  ADD COLUMN external_url text,
  ADD COLUMN imported_at timestamptz,
  ADD COLUMN is_imported boolean NOT NULL DEFAULT false,
  ADD COLUMN external_author_name text,
  ADD COLUMN external_channel text,
  ADD COLUMN source_created_at timestamptz;

ALTER TABLE public.project_messages ALTER COLUMN user_id DROP NOT NULL;

-- native (non-imported) messages must still have a real author
ALTER TABLE public.project_messages
  ADD CONSTRAINT project_messages_author_required
  CHECK (is_imported = true OR user_id IS NOT NULL);

-- dedupe guards
CREATE UNIQUE INDEX idx_tasks_external_unique ON public.project_tasks (project_id, source_provider, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_milestones_external_unique ON public.milestones (project_id, source_provider, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_files_external_unique ON public.project_files (project_id, source_provider, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_notes_external_unique ON public.project_notes (project_id, source_provider, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_deliverables_external_unique ON public.project_deliverables (project_id, source_provider, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_messages_external_unique ON public.project_messages (project_id, source_provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_messages_imported ON public.project_messages (project_id, is_imported) WHERE is_imported = true;

-- imported messages are readable by project members (native SELECT policies key off membership already,
-- but add an explicit read for rows with NULL user_id)
CREATE POLICY "Project members read imported messages"
  ON public.project_messages FOR SELECT TO authenticated
  USING (is_imported = true AND public.user_has_project_access(project_id, auth.uid()));

-- =============== 8. updated_at triggers ===============
CREATE TRIGGER trg_integration_connections_updated BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_jobs_updated BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_source_objects_updated BEFORE UPDATE ON public.import_source_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_mappings_updated BEFORE UPDATE ON public.import_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_suggestions_updated BEFORE UPDATE ON public.import_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
