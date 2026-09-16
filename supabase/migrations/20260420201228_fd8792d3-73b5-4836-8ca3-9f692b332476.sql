
-- ============================================================
-- ThriveDesk Round 1: fix file access + add folders
-- ============================================================

-- 1) Add folders table
CREATE TABLE IF NOT EXISTS public.project_file_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.project_file_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_file_folders_project ON public.project_file_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_file_folders_parent ON public.project_file_folders(parent_id);

ALTER TABLE public.project_file_folders ENABLE ROW LEVEL SECURITY;

-- Reuse existing access function
CREATE POLICY "Folders viewable by project members"
  ON public.project_file_folders FOR SELECT
  TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Folders insertable by project members"
  ON public.project_file_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.user_has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Folders updatable by project members"
  ON public.project_file_folders FOR UPDATE
  TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Folders deletable by project members"
  ON public.project_file_folders FOR DELETE
  TO authenticated
  USING (public.user_has_project_access(project_id, auth.uid()));

CREATE TRIGGER trg_project_file_folders_updated
  BEFORE UPDATE ON public.project_file_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add folder_id to project_files
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.project_file_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_files_folder ON public.project_files(folder_id);

-- 3) Fix project-files storage RLS
-- Files are stored as: <projectId>/<timestamp>.<ext>
-- So storage.foldername(name)[1] = projectId
DROP POLICY IF EXISTS "Project files access for collaborators" ON storage.objects;
DROP POLICY IF EXISTS "Project files access for owners" ON storage.objects;
DROP POLICY IF EXISTS "Project files delete" ON storage.objects;
DROP POLICY IF EXISTS "Project files upload" ON storage.objects;

CREATE POLICY "Project files: project members can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.user_has_project_access(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project files: project members can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND public.user_has_project_access(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project files: project members can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.user_has_project_access(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project files: project members can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.user_has_project_access(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );
