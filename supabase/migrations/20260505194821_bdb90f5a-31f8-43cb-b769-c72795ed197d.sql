ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS is_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_provider text,
  ADD COLUMN IF NOT EXISTS link_thumbnail_url text;

CREATE INDEX IF NOT EXISTS idx_project_files_is_link ON public.project_files(project_id, is_link);