CREATE TABLE public.studio_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_folders TO authenticated;
GRANT ALL ON public.studio_folders TO service_role;

ALTER TABLE public.studio_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their studio folders"
  ON public.studio_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX studio_folders_user_idx ON public.studio_folders(user_id, sort_order);

CREATE TRIGGER studio_folders_set_updated_at
  BEFORE UPDATE ON public.studio_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS studio_folder_id uuid REFERENCES public.studio_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_studio_folder_idx ON public.projects(studio_folder_id);